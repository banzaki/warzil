import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, STATES, STATE_IDS } from '../src/game/data.js';
import {
  attack,
  blitz,
  calcReinforcements,
  canAttack,
  createGame,
  endAttack,
  endTurn,
  finishRally,
  occupy,
  placeTroops,
  resetRally,
  territoriesOf,
  undoPlacement,
} from '../src/game/engine.js';
import { aiStep } from '../src/game/ai.js';

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
const dice = (...faces) => {
  let i = 0;
  return () => (faces[i++ % faces.length] - 1) / 6 + 0.01;
};
const total = (g) => STATE_IDS.reduce((s, id) => s + g.troops[id], 0);
const rallyAll = (g) => finishRally(placeTroops(g, territoriesOf(g, g.current)[0], g.reinforcements));

const LINEUPS = [
  ['lula', ['flavio']],
  ['flavio', ['lula', 'cury']],
  ['renan', ['lula', 'flavio', 'caiado']],
];

test('every faction rallies before anyone attacks (2, 3 and 4 factions)', () => {
  for (const [human, rivals] of LINEUPS) {
    let g = createGame(human, seeded(1), rivals);
    const order = [human, ...rivals];
    const rallied = [];
    while (g.phase === 'reinforce') {
      rallied.push(g.current);
      // Nobody can attack during the rally, whoever's turn it is.
      for (const from of STATE_IDS) {
        for (const to of STATE_IDS) assert.equal(canAttack(g, from, to), false);
      }
      g = rallyAll(g);
    }
    assert.deepEqual(rallied, order, 'rally follows turn order');
    assert.equal(g.current, human);
    assert.equal(g.phase, 'attack');
    assert.equal(g.round, 1);
  }
});

test('battle turns follow the order, then a new round rallies again', () => {
  let g = createGame('lula', seeded(2), ['flavio', 'cury', 'renan']);
  while (g.phase === 'reinforce') g = rallyAll(g);
  const battles = [];
  while (g.phase !== 'reinforce') {
    battles.push(g.current);
    g = endTurn(g);
  }
  assert.deepEqual(battles, ['lula', 'flavio', 'cury', 'renan']);
  assert.equal(g.current, 'lula');
  assert.equal(g.round, 2);
  assert.equal(endTurn(g), g, 'endTurn cannot skip the rally');
});

test('rally cannot be confirmed with reinforcements left', () => {
  let g = createGame('lula', seeded(3));
  assert.ok(g.reinforcements > 1);
  g = placeTroops(g, territoriesOf(g, 'lula')[0], 1);
  assert.equal(finishRally(g), g);
});

test('reinforcements are counted when each faction rallies, region bonuses included', () => {
  // Lula holds the whole South when the round starts.
  let g = createGame('lula', seeded(4), ['flavio']);
  const owner = Object.fromEntries(STATE_IDS.map((id) => [id, STATES[id].region === 'south' ? 'lula' : 'flavio']));
  owner.am = 'lula';
  owner.pa = 'lula';
  g = { ...g, owner };
  while (g.phase !== 'attack') g = rallyAll(g);
  g = endTurn(endTurn(g)); // both battle turns end -> round 2 rally
  assert.equal(g.phase, 'reinforce');
  assert.equal(g.current, 'lula');
  const expected = Math.max(3, Math.floor(5 / 2)) + REGIONS.south.bonus;
  assert.equal(g.reinforcements, expected);
  assert.equal(g.reinforcements, calcReinforcements(g, 'lula').total);
});

test('eliminated factions skip both the rally and the battle', () => {
  let g = createGame('lula', seeded(5), ['flavio', 'cury']);
  while (g.phase === 'reinforce') g = rallyAll(g);
  // Lula wipes Flávio out during the battle stage.
  const owner = Object.fromEntries(STATE_IDS.map((id) => [id, 'cury']));
  Object.assign(owner, { sp: 'lula', mg: 'lula', pr: 'flavio' });
  g = { ...g, owner, troops: { ...g.troops, sp: 20, pr: 1 } };
  g = blitz(g, 'sp', 'pr', dice(6, 1));
  assert.deepEqual(g.eliminated, ['flavio']);
  g = endTurn(endAttack(occupy(g, 1)));
  assert.equal(g.current, 'cury', 'Flávio has no battle turn');
  g = endTurn(g);
  const rallied = [];
  while (g.phase === 'reinforce') {
    rallied.push(g.current);
    g = rallyAll(g);
  }
  assert.deepEqual(rallied, ['lula', 'cury'], 'Flávio has no rally either');
});

test('undo and reset give back exactly what was placed, never more', () => {
  let g = createGame('lula', seeded(6));
  const start = { troops: { ...g.troops }, reinforcements: g.reinforcements, sum: total(g) };
  const [a, b] = territoriesOf(g, 'lula');
  g = placeTroops(g, a, 2);
  g = placeTroops(g, b, 1);
  g = placeTroops(g, a, 99); // all the rest
  assert.equal(g.reinforcements, 0);
  assert.equal(total(g), start.sum + start.reinforcements);

  g = undoPlacement(g);
  assert.equal(g.reinforcements, start.reinforcements - 3);
  assert.equal(g.troops[a], start.troops[a] + 2);
  g = undoPlacement(g);
  assert.equal(g.troops[b], start.troops[b]);
  g = resetRally(placeTroops(g, b, 1));
  assert.deepEqual(g.troops, start.troops);
  assert.equal(g.reinforcements, start.reinforcements);
  // Nothing left to undo: no-op, never negative armies or extra reinforcements.
  assert.equal(undoPlacement(g), g);
  assert.equal(resetRally(g), g);
});

test('undo is impossible once the rally is confirmed', () => {
  let g = createGame('lula', seeded(7));
  g = placeTroops(g, territoriesOf(g, 'lula')[0], g.reinforcements);
  const sum = total(g);
  g = finishRally(g);
  assert.equal(g.current, 'flavio');
  assert.deepEqual(g.rallyPlacements, [], "the next faction starts with a clean slate");
  assert.equal(undoPlacement(g), g);
  assert.equal(total(g), sum);
});

test('AI rallies on its own and confirms', () => {
  const rng = seeded(8);
  let g = createGame('lula', rng, ['flavio', 'cury']);
  g = rallyAll(g);
  let steps = 0;
  while (g.phase === 'reinforce' && steps++ < 50) g = aiStep(g, rng);
  assert.ok(steps < 50);
  assert.equal(g.phase, 'attack');
  assert.equal(g.current, 'lula', 'battle starts with the human, who is first in order');
});

test('first attack of the match happens only after all reinforcements are on the map', () => {
  for (const [human, rivals] of LINEUPS) {
    const rng = seeded(9);
    let g = createGame(human, rng, rivals, { spectator: true });
    const deal = total(g);
    const due = g.factions.reduce((s, f) => s + calcReinforcements(g, f).total, 0);
    while (!g.lastRoll && g.phase !== 'over') {
      const before = g;
      g = aiStep(g, rng);
      if (g.lastRoll) assert.equal(total(before), deal + due, 'every faction rallied before the first roll');
    }
  }
});

test('attacks still work normally in the battle stage', () => {
  let g = createGame('lula', seeded(10));
  while (g.phase === 'reinforce') g = rallyAll(g);
  const from = territoriesOf(g, 'lula').find((id) => g.troops[id] >= 2 && STATE_IDS.some((t) => canAttack(g, id, t)));
  const to = STATE_IDS.find((t) => canAttack(g, from, t));
  assert.notEqual(attack(g, from, to), g);
});

test('AI tie-break between equally weak rivals does not depend on seat', async () => {
  const { weakestOf } = await import('../src/game/ai.js');
  // Lula holds 9 states, Flávio/Cury/Renan 6 each: every AI faces a tie.
  const owner = Object.fromEntries(STATE_IDS.map((id, i) => [id, i < 9 ? 'lula' : ['flavio', 'cury', 'renan'][i % 3]]));
  const g = { ...createGame('lula', seeded(1), ['flavio', 'cury', 'renan']), owner };
  assert.deepEqual(['lula', 'flavio', 'cury', 'renan'].map((f) => territoriesOf(g, f).length), [9, 6, 6, 6]);
  // Each one picks the tied rival who plays right after it (not always the earliest seat).
  assert.equal(weakestOf(g, 'lula'), 'flavio');
  assert.equal(weakestOf(g, 'flavio'), 'cury');
  assert.equal(weakestOf(g, 'cury'), 'renan');
  assert.equal(weakestOf(g, 'renan'), 'flavio');
  // A strictly weaker rival still wins over the tie rule.
  const weaker = { ...g, owner: { ...owner, [STATE_IDS.find((id) => owner[id] === 'renan')]: 'lula' } };
  assert.equal(weakestOf(weaker, 'lula'), 'renan');
});
