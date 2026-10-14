import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATE_IDS } from '../src/game/data.js';
import { attackTargets, movableTroops, territoriesOf } from '../src/game/engine.js';
import { seededRng } from '../src/game/daily.js';
import {
  COVER_AFTER_MS,
  IDLE_COVER_MS,
  leaveRoom,
  ROOM_TTL_MS,
  backToLobby,
  createRoom,
  isExpired,
  joinRoom,
  needsServerMove,
  pickFaction,
  playerAction,
  playerByToken,
  publicView,
  rematch,
  serverMove,
  setConnected,
  setSettings,
  startGame,
} from '../worker/room.js';

const T0 = 1_700_000_000_000;

function lobby(nicks = ['Ana', 'Beto'], picks = ['lula', 'flavio']) {
  let { room } = createRoom({ code: 'ABCDE', nick: nicks[0], token: 't0', playerId: 'p0', now: T0 });
  for (let i = 1; i < nicks.length; i++) room = joinRoom(room, { nick: nicks[i], token: `t${i}`, playerId: `p${i}`, now: T0 }).room;
  picks.forEach((f, i) => (room = pickFaction(room, `p${i}`, f, T0).room));
  return room;
}

// A simple human policy, sent as messages: rally all on one state, attack when
// clearly stronger, occupy with everything, end the turn.
function humanMove(game) {
  const me = game.current;
  if (game.phase === 'reinforce') {
    if (game.reinforcements > 0) {
      const front = territoriesOf(game, me).find((id) => attackTargets({ ...game, phase: 'attack' }, id).length) ?? territoriesOf(game, me)[0];
      return { kind: 'place', id: front, amount: game.reinforcements };
    }
    return { kind: 'finishRally' };
  }
  if (game.phase === 'attack') {
    for (const from of territoriesOf(game, me)) {
      const to = attackTargets(game, from).find((t) => game.troops[from] >= game.troops[t] + 2);
      if (to) return { kind: 'blitz', from, to };
    }
    return { kind: 'endAttack' };
  }
  if (game.phase === 'occupy') return { kind: 'occupy', total: game.pendingOccupy.max };
  return { kind: 'endTurn' };
}

// Plays a whole match through the room API: humans send actions, the server moves the AI.
function playOut(room, rng, maxSteps = 20000) {
  const seq = {};
  let now = T0;
  for (let step = 0; step < maxSteps && room.status === 'playing'; step++) {
    now += 10;
    if (needsServerMove(room, now)) {
      room = serverMove(room, rng, now).room;
      continue;
    }
    const pid = room.controllers[room.game.current];
    seq[pid] = (seq[pid] ?? 0) + 1;
    const res = playerAction(room, pid, humanMove(room.game), seq[pid], rng, now);
    assert.equal(res.error, undefined, `step ${step}: ${res.error}`);
    room = res.room;
  }
  return room;
}

test('create a room, join, unique candidates, host-only settings', () => {
  let { room } = createRoom({ code: 'ABCDE', nick: '  Ana  ', token: 't0', playerId: 'p0', now: T0 });
  assert.equal(room.players[0].nick, 'Ana');
  assert.equal(createRoom({ code: 'X', nick: '   ', token: 't', playerId: 'p', now: T0 }).error, 'nick');
  room = joinRoom(room, { nick: 'Beto', token: 't1', playerId: 'p1', now: T0 }).room;
  assert.equal(joinRoom(room, { nick: 'beto', token: 't2', playerId: 'p2', now: T0 }).error, 'nick-taken');
  assert.equal(playerByToken(room, 't1').id, 'p1');
  assert.equal(playerByToken(room, 'nope'), null);

  room = pickFaction(room, 'p0', 'lula', T0).room;
  assert.equal(pickFaction(room, 'p1', 'lula', T0).error, 'faction-taken', 'one candidate per player');
  assert.equal(pickFaction(room, 'p1', 'bolsonaro', T0).error, 'faction');
  room = pickFaction(room, 'p1', 'flavio', T0).room;

  assert.equal(setSettings(room, 'p1', { armies: 2 }, T0).error, 'host-only');
  room = setSettings(room, 'p0', { armies: 'mixed', aiCount: 9 }, T0).room;
  assert.deepEqual(room.settings, { armies: 'mixed', aiCount: 2 }, 'AI fill capped at 4 participants');
  assert.equal(joinRoom(room, { nick: 'Caio', token: 't9', playerId: 'p9', now: T0 }).error, 'full');
});

test('the host starts only when everybody picked; tokens never leave the server', () => {
  let room = lobby(['Ana', 'Beto'], ['lula']);
  assert.equal(startGame(room, 'p0', seededRng(1), T0).error, 'pick-first');
  room = pickFaction(room, 'p1', 'renan', T0).room;
  assert.equal(startGame(room, 'p1', seededRng(1), T0).error, 'host-only');
  room = startGame(room, 'p0', seededRng(1), T0).room;
  assert.equal(room.status, 'playing');
  assert.deepEqual([...room.game.factions].sort(), ['lula', 'renan'], 'order drawn by the server');
  assert.equal(room.game.human, null, 'no single "human": everybody is a player');
  assert.deepEqual(room.controllers, { lula: 'p0', renan: 'p1' });
  const view = JSON.stringify(publicView(room, 'p1'));
  assert.ok(!view.includes('"t0"') && !view.includes('"t1"'), 'no tokens in what clients receive');
  assert.equal(publicView(room, 'p1').you, 'p1');
});

test('only the player on turn can act; duplicates and illegal moves are rejected', () => {
  let room = startGame(lobby(), 'p0', seededRng(2), T0).room;
  const current = room.controllers[room.game.current];
  const other = current === 'p0' ? 'p1' : 'p0';
  assert.equal(playerAction(room, other, { kind: 'finishRally' }, 1, seededRng(3), T0).error, 'not-your-turn');

  const own = territoriesOf(room.game, room.game.current)[0];
  const place = playerAction(room, current, { kind: 'place', id: own, amount: 1 }, 1, seededRng(3), T0);
  assert.equal(place.error, undefined);
  const resent = playerAction(place.room, current, { kind: 'place', id: own, amount: 1 }, 1, seededRng(3), T0);
  assert.equal(resent.error, 'duplicate', 'same seq twice -> no extra army');
  assert.equal(resent.room.game.troops[own], place.room.game.troops[own]);

  const enemy = STATE_IDS.find((id) => room.game.owner[id] !== room.game.current);
  assert.equal(playerAction(place.room, current, { kind: 'place', id: enemy, amount: 1 }, 2, seededRng(3), T0).error, 'illegal');
  assert.equal(playerAction(place.room, current, { kind: 'teleport' }, 3, seededRng(3), T0).error, 'action');
  assert.equal(playerAction(place.room, current, { kind: 'place', id: own, amount: -5 }, 4, seededRng(3), T0).error, 'illegal');
});

test('two players play a whole match through the server, then rematch', () => {
  const rng = seededRng(4);
  let room = startGame(lobby(), 'p0', rng, T0).room;
  room = playOut(room, rng);
  assert.equal(room.status, 'over');
  assert.ok(['lula', 'flavio'].includes(room.game.winner));
  assert.equal(territoriesOf(room.game, room.game.winner).length, 27);
  assert.equal(rematch(room, 'p1', rng, T0).error, 'host-only');
  const again = rematch(room, 'p0', rng, T0).room;
  assert.equal(again.status, 'playing');
  assert.deepEqual([...again.game.factions].sort(), [...room.game.factions].sort(), 'same line-up (new draw)');
  assert.equal(again.game.round, 1);
  assert.equal(backToLobby(again, 'p0', T0).room.status, 'lobby');
});

test('three and four participants, humans and AI fill, with eliminations', () => {
  for (const [nicks, picks, aiCount, seed] of [
    [['Ana', 'Beto', 'Caio'], ['lula', 'flavio', 'cury'], 0, 5],
    [['Ana', 'Beto'], ['renan', 'caiado'], 2, 6],
    [['Ana', 'Beto', 'Caio', 'Duda'], ['lula', 'flavio', 'cury', 'renan'], 0, 7],
  ]) {
    const rng = seededRng(seed);
    let room = setSettings(lobby(nicks, picks), 'p0', { armies: 1, aiCount }, T0).room;
    room = startGame(room, 'p0', rng, T0).room;
    assert.equal(room.game.factions.length, nicks.length + aiCount);
    assert.equal(Object.values(room.controllers).filter((c) => c === 'ai').length, aiCount);
    room = playOut(room, rng);
    assert.equal(room.status, 'over');
    assert.equal(room.game.eliminated.length, room.game.factions.length - 1);
  }
});

test('a disconnected player keeps the candidate; the AI covers the turn after a while', () => {
  let room = startGame(lobby(), 'p0', seededRng(8), T0).room;
  const pid = room.controllers[room.game.current];
  room = setConnected(room, pid, true, T0).room;
  room = setConnected(room, pid, false, T0).room;
  assert.equal(needsServerMove(room, T0 + 5000), false, 'a short drop does not hand the turn to the AI');
  assert.equal(needsServerMove(room, T0 + COVER_AFTER_MS), true);
  const covered = serverMove(room, seededRng(9), T0 + COVER_AFTER_MS).room;
  assert.notEqual(covered.game, room.game);
  // Reconnecting gives the turn back, same candidate.
  room = setConnected(covered, pid, true, T0 + COVER_AFTER_MS + 1).room;
  assert.equal(needsServerMove(room, T0 + COVER_AFTER_MS + 2), room.controllers[room.game.current] === 'ai');
  assert.equal(room.players.find((p) => p.id === pid).faction, room.game.factions.find((f) => room.controllers[f] === pid));
});

test('inactive rooms expire', () => {
  const room = lobby();
  assert.equal(isExpired(room, T0 + 1000), false);
  assert.equal(isExpired(room, T0 + ROOM_TTL_MS), true);
});

test('movement through the server keeps the no-chaining rule', () => {
  let room = startGame(lobby(), 'p0', seededRng(10), T0).room;
  // Jump to a fortify phase with a crafted board, then move twice from the same state.
  const me = room.game.current;
  const pid = room.controllers[me];
  const owner = Object.fromEntries(STATE_IDS.map((id) => [id, me]));
  owner.rs = room.game.factions.find((f) => f !== me);
  room = { ...room, game: { ...room.game, owner, phase: 'fortify', troops: { ...room.game.troops, sp: 6, mg: 1 }, movedOut: {}, received: {} } };
  const moved = playerAction(room, pid, { kind: 'fortify', from: 'sp', to: 'mg', amount: 5 }, 1, seededRng(1), T0).room;
  assert.equal(moved.game.troops.mg, 6);
  assert.equal(movableTroops(moved.game, 'sp'), 0);
  assert.equal(playerAction(moved, pid, { kind: 'fortify', from: 'sp', to: 'rj', amount: 1 }, 2, seededRng(1), T0).error, 'illegal');
});

test('leaving the lobby frees the seat; the host role passes on; empty rooms close', () => {
  let room = lobby(['Ana', 'Beto', 'Caio'], ['lula', 'flavio']);
  room = leaveRoom(room, 'p2', T0).room; // Caio leaves without picking
  assert.equal(room.players.length, 2);
  assert.equal(startGame(room, 'p0', seededRng(1), T0).error, undefined, 'host can start again');
  room = leaveRoom(room, 'p0', T0).room; // host leaves
  assert.equal(room.hostId, 'p1');
  assert.equal(leaveRoom(room, 'p1', T0).room, null, 'last player out closes the room');
});

test('leaving during a match keeps the candidate and hands the turn to the AI', () => {
  let room = startGame(lobby(), 'p0', seededRng(11), T0).room;
  const pid = room.controllers[room.game.current];
  room = leaveRoom(room, pid, T0).room;
  assert.equal(room.status, 'playing');
  assert.equal(room.players.length, 2);
  assert.equal(needsServerMove(room, T0), true, 'AI covers right away');
});

test('a connected but idle player is covered by the AI after a while', () => {
  let room = startGame(lobby(), 'p0', seededRng(12), T0).room;
  room = setConnected(setConnected(room, 'p0', true, T0).room, 'p1', true, T0).room;
  assert.equal(needsServerMove(room, T0 + 30_000), false);
  assert.equal(needsServerMove(room, T0 + IDLE_COVER_MS), true);
  const moved = serverMove(room, seededRng(13), T0 + IDLE_COVER_MS).room;
  assert.equal(needsServerMove(moved, T0 + IDLE_COVER_MS + 1), false, 'a move resets the idle clock');
});
