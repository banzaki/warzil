import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATE_IDS } from '../src/game/data.js';
import { createGame, territoriesOf } from '../src/game/engine.js';
import { aiStep } from '../src/game/ai.js';
import { createLocalGame, localPlayers, needsHandoff, validSeats, viewerOf } from '../src/game/hotseat.js';

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seat = (faction, human = true, nick = '') => ({ faction, human, nick });

const LINEUPS = [
  [seat('lula'), seat('flavio')],
  [seat('lula'), seat('flavio'), seat('cury')],
  [seat('lula'), seat('flavio'), seat('cury'), seat('renan')],
  [seat('caiado'), seat('flavio', false), seat('renan')],
  [seat('lula'), seat('flavio', false), seat('cury', false), seat('renan')],
];

// Plays a whole match the way the screen does: every seat moves through the same
// engine (people are stood in for by the AI here), and the device changes hands
// whenever a person's turn comes up after somebody else confirmed.
function playLocal(seats, seed) {
  const rng = seeded(seed);
  const { humans } = localPlayers(seats);
  let game = createLocalGame(seats, rng);
  let readyFor = null;
  const handoffs = [];
  const humanTurns = [];
  for (let steps = 0; game.phase !== 'over'; steps++) {
    assert.ok(steps < 20000, 'the match ends');
    if (needsHandoff(game, humans, readyFor)) {
      handoffs.push({ to: game.current, from: readyFor, round: game.round });
      readyFor = game.current;
    }
    if (humans.includes(game.current)) {
      assert.equal(viewerOf(game, humans), game.current, 'the person playing sees the board');
      if (humanTurns.at(-1) !== game.current) humanTurns.push(game.current);
    }
    game = aiStep(game, rng);
  }
  return { game, humans, handoffs, humanTurns };
}

test('local games with 2, 3 and 4 seats (people and AI) end with one winner holding the map', () => {
  for (const seats of LINEUPS) {
    for (let seed = 1; seed <= 6; seed++) {
      const { game } = playLocal(seats, seed);
      assert.equal(game.phase, 'over');
      assert.ok(seats.some((s) => s.faction === game.winner));
      assert.equal(territoriesOf(game, game.winner).length, STATE_IDS.length);
      assert.equal(game.eliminated.length, seats.length - 1);
      assert.ok(!game.log.some((e) => e.type === 'knockout'), 'losing one person never ends the match early');
    }
  }
});

test('the device changes hands every time another person has to play', () => {
  for (const seats of LINEUPS) {
    const { handoffs, humanTurns } = playLocal(seats, 11);
    assert.ok(handoffs.length >= 2);
    handoffs.forEach((h) => assert.notEqual(h.to, h.from, 'never asks the same person twice in a row'));
    // Each change of person at the controls was preceded by a hand-over to them.
    assert.deepEqual(
      handoffs.map((h) => h.to),
      humanTurns.filter((f, i) => i === 0 || humanTurns[i - 1] !== f),
    );
  }
});

test('the opening rally is collective and order and bonuses match a solo game', () => {
  for (const seats of LINEUPS) {
    const factions = seats.map((s) => s.faction);
    const local = createLocalGame(seats, seeded(5));
    const solo = createGame(factions[0], seeded(5), factions.slice(1));
    // Same draw, same deal, same compensation: nobody gains by being a person or the AI.
    for (const key of ['factions', 'owner', 'troops', 'positionBonus', 'openingBonus', 'current', 'phase', 'reinforcements']) {
      assert.deepEqual(local[key], solo[key], key);
    }
    assert.equal(local.human, null);
    assert.equal(local.round, 1);
    assert.equal(local.phase, 'reinforce');
  }
});

test('a person eliminated mid-match leaves the others playing', () => {
  let seen = false;
  for (let seed = 1; seed <= 30 && !seen; seed++) {
    const seats = LINEUPS[2];
    const { game, humans } = playLocal(seats, seed);
    const firstOut = game.log.filter((e) => e.type === 'eliminated').at(-1);
    if (firstOut && humans.includes(firstOut.loser)) seen = true;
    assert.notEqual(game.winner, null);
  }
  assert.ok(seen, 'some seed eliminates a person before the end');
});

test('rematch keeps the seats and draws a new order', () => {
  const seats = LINEUPS[2];
  const orders = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const g = createLocalGame(seats, seeded(seed));
    assert.deepEqual([...g.factions].sort(), seats.map((s) => s.faction).sort());
    orders.add(g.factions.join());
  }
  assert.ok(orders.size > 1, 'each match draws its own order');
});

test('seat validation and names', () => {
  assert.ok(validSeats(LINEUPS[0]));
  assert.ok(!validSeats([seat('lula'), seat('flavio', false)]), 'needs at least two people');
  assert.ok(!validSeats([seat('lula'), seat('lula')]), 'candidates are all different');
  assert.ok(!validSeats([seat('lula')]));
  const { humans, names } = localPlayers([seat('lula', true, '  Ana  '), seat('flavio', false), seat('cury', true, '')]);
  assert.deepEqual(humans, ['lula', 'cury']);
  assert.deepEqual(names, { lula: 'Ana', cury: 'Jogador 3' });
});

test('during an AI turn the board stays with the last person who played', () => {
  const g = { factions: ['lula', 'flavio', 'cury'], current: 'flavio', eliminated: [] };
  assert.equal(viewerOf(g, ['lula', 'cury']), 'lula');
  assert.equal(viewerOf({ ...g, eliminated: ['lula'] }, ['lula', 'cury']), 'cury');
  assert.ok(!needsHandoff({ ...g, current: 'lula', phase: 'attack' }, ['lula', 'cury'], 'lula'));
  assert.ok(needsHandoff({ ...g, current: 'cury', phase: 'reinforce' }, ['lula', 'cury'], 'lula'));
  assert.ok(!needsHandoff({ ...g, current: 'cury', phase: 'over' }, ['lula', 'cury'], 'lula'));
});
