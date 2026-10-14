import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_GAP_MS, deviceType, isUuid, nextSession, referrerOf, utmFrom, uuidv7 } from '../src/game/analytics.js';
import { IDLE_AFTER_MS, newClock, tick } from '../src/game/matchClock.js';
import { roomEvents } from '../worker/analytics.js';
import { createRoom, joinRoom, leaveRoom, pickFaction, publicView, rematch, serverMove, setConnected, startGame } from '../worker/room.js';
import { seededRng } from '../src/game/daily.js';

const T0 = 1_700_000_000_000;
const AID = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];

test('session ids are UUIDv7 and a session ends after 30 minutes of silence', () => {
  const id = uuidv7(T0);
  assert.ok(isUuid(id));
  assert.equal(id[14], '7', 'version 7');
  assert.equal(parseInt(id.replace(/-/g, '').slice(0, 12), 16), T0, 'starts with the timestamp');
  const s1 = nextSession(null, T0);
  assert.equal(nextSession(s1, T0 + SESSION_GAP_MS - 1).id, s1.id);
  assert.notEqual(nextSession(s1, T0 + SESSION_GAP_MS).id, s1.id);
});

test('visit source keeps campaign tags and the other site only, never paths or room codes', () => {
  assert.deepEqual(utmFrom('?sala=ABCD1234&utm_source=tiktok&utm_campaign=trailer01'), { utm_source: 'tiktok', utm_campaign: 'trailer01' });
  assert.deepEqual(referrerOf('https://www.tiktok.com/@warzil/video/123?x=1', 'warzil.com.br'), { $referrer: 'https://www.tiktok.com', $referring_domain: 'www.tiktok.com' });
  assert.deepEqual(referrerOf('https://warzil.com.br/?sala=ABCD1234', 'warzil.com.br'), {});
  assert.deepEqual(referrerOf('', 'warzil.com.br'), { $referrer: '$direct', $referring_domain: '$direct' });
  assert.equal(deviceType(390, true), 'Mobile');
  assert.equal(deviceType(1280, false), 'Desktop');
});

test('an open tab is not playtime: active, idle, waiting and hidden are separate', () => {
  let c = newClock();
  const now = T0;
  c = tick(c, { visible: true, myTurn: true, now, lastInputAt: now - 1000 });
  c = tick(c, { visible: true, myTurn: true, now, lastInputAt: now - IDLE_AFTER_MS });
  c = tick(c, { visible: true, myTurn: false, now, lastInputAt: now });
  c = tick(c, { visible: false, myTurn: true, now, lastInputAt: now });
  assert.deepEqual(c, { active: 1, idle: 1, waiting: 1, hidden: 1 });
});

function lobby() {
  let { room } = createRoom({ code: 'ABCDEFGH', nick: 'Ana', token: 't0', playerId: 'p0', now: T0, aid: AID[0] });
  room = joinRoom(room, { nick: 'Beto', token: 't1', playerId: 'p1', now: T0, aid: AID[1] }).room;
  room = pickFaction(room, 'p0', 'lula', T0).room;
  return pickFaction(room, 'p1', 'flavio', T0).room;
}
const names = (evs) => evs.map((e) => `${e.event}:${e.aid.slice(0, 1)}`);

test('online rooms report creation, joins, starts and results from state changes only', () => {
  const created = createRoom({ code: 'ABCDEFGH', nick: 'Ana', token: 't0', playerId: 'p0', now: T0, aid: AID[0] }).room;
  assert.deepEqual(names(roomEvents(null, created, T0)), ['room_created:1']);
  const joined = joinRoom(created, { nick: 'Beto', token: 't1', playerId: 'p1', now: T0, aid: AID[1] }).room;
  assert.deepEqual(names(roomEvents(created, joined, T0)), ['room_joined:2']);

  const before = lobby();
  const started = { ...startGame(before, 'p0', seededRng(1), T0).room, matchRef: 'm1' };
  const ev = roomEvents(before, started, T0);
  assert.deepEqual(names(ev), ['match_started:1', 'match_started:2']);
  assert.equal(ev[0].props.match_id, 'm1');
  assert.equal(ev[0].props.humans, 2);
  assert.deepEqual(roomEvents(started, started, T0), [], 'the same state again (reload, reconnect) adds nothing');

  // Play to the end with the AI covering everyone, then check the result events.
  let room = started;
  let prev = room;
  let finished = [];
  for (let i = 0; i < 5000 && room.status === 'playing'; i++) {
    prev = room;
    room = serverMove({ ...room, covering: room.game.current }, seededRng(i), T0 + 60_000).room;
  }
  finished = roomEvents(prev, room, T0 + 600_000);
  assert.equal(room.status, 'over');
  const results = finished.filter((e) => e.event === 'match_completed');
  assert.equal(results.length, 2);
  assert.deepEqual(results.map((e) => e.props.result).sort(), ['loss', 'win']);
  assert.equal(results[0].props.duration_s, 600);
  assert.deepEqual(roomEvents(room, room, T0), [], 'a finished match is reported once');

  const again = { ...rematch(room, 'p0', seededRng(9), T0).room, matchRef: 'm2' };
  assert.deepEqual(names(roomEvents(room, again, T0)), ['match_started:1', 'match_started:2', 'rematch_started:1']);
});

test('disconnects, reconnects and leaving mid-match; nothing personal in the events', () => {
  const start = { ...startGame(lobby(), 'p0', seededRng(2), T0).room, matchRef: 'm1' };
  const on = setConnected(start, 'p1', true, T0).room;
  const off = setConnected(on, 'p1', false, T0 + 1000).room;
  assert.deepEqual(names(roomEvents(on, off, T0)), ['online_disconnected:2']);
  const back = setConnected(off, 'p1', true, T0 + 2000).room;
  assert.deepEqual(names(roomEvents(off, back, T0)), ['online_reconnected:2']);
  const left = leaveRoom(back, 'p1', T0 + 3000).room;
  assert.deepEqual(names(roomEvents(back, left, T0)), ['match_abandoned:2']);
  const text = JSON.stringify([...roomEvents(null, start, T0), ...roomEvents(back, left, T0)]);
  for (const secret of ['Ana', 'Beto', 'ABCDEFGH', 't0', 't1']) assert.ok(!text.includes(secret), `no ${secret} in events`);
});

test('players without an analytics id (opted out) produce no events; ids never reach other players', () => {
  let { room } = createRoom({ code: 'ABCDEFGH', nick: 'Ana', token: 't0', playerId: 'p0', now: T0 });
  assert.deepEqual(roomEvents(null, room, T0), []);
  ({ room } = createRoom({ code: 'ABCDEFGH', nick: 'Ana', token: 't0', playerId: 'p0', now: T0, aid: 'not-a-uuid' }));
  assert.equal(room.players[0].aid, null, 'malformed ids are dropped');
  const view = JSON.stringify(publicView(lobby(), 'p1', T0));
  assert.ok(!view.includes(AID[0]) && !view.includes(AID[1]), 'publicView never carries analytics ids');
});
