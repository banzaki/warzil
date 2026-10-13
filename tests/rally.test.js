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
    let g = createGame(human, seeded(1), rivals, { opener: 0 });
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

test('battle turns follow the order, then later rounds are full turns', () => {
  let g = createGame('lula', seeded(2), ['flavio', 'cury', 'renan'], { opener: 0 });
  while (g.phase === 'reinforce') g = rallyAll(g);
  const battles = [];
  while (g.phase !== 'reinforce') {
    battles.push(g.current);
    g = endTurn(g);
  }
  assert.deepEqual(battles, ['lula', 'flavio', 'cury', 'renan']);
  assert.equal(g.current, 'flavio', 'round 2 opens with the second seat');
  assert.equal(g.round, 2);
  assert.equal(endTurn(g), g, 'endTurn cannot skip the rally');
  // Round 2: each faction rallies and battles before the next one starts.
  const turns = [];
  while (g.round === 2) {
    if (g.phase === 'reinforce') {
      turns.push(`rally:${g.current}`);
      g = rallyAll(g);
    } else {
      turns.push(`battle:${g.current}`);
      g = endTurn(g);
    }
  }
  assert.deepEqual(turns, ['rally:flavio', 'battle:flavio', 'rally:cury', 'battle:cury', 'rally:renan', 'battle:renan', 'rally:lula', 'battle:lula']);
  assert.equal(g.current, 'cury', 'round 3 opens with the third seat');
});

test('rally cannot be confirmed with reinforcements left', () => {
  let g = createGame('lula', seeded(3), undefined, { opener: 0 });
  assert.ok(g.reinforcements > 1);
  g = placeTroops(g, territoriesOf(g, 'lula')[0], 1);
  assert.equal(finishRally(g), g);
});

test('reinforcements are counted when each faction rallies, region bonuses included', () => {
  // Lula holds the whole South when the round starts.
  let g = createGame('lula', seeded(4), ['flavio'], { opener: 0 });
  const owner = Object.fromEntries(STATE_IDS.map((id) => [id, STATES[id].region === 'south' ? 'lula' : 'flavio']));
  owner.am = 'lula';
  owner.pa = 'lula';
  g = { ...g, owner };
  while (g.phase !== 'attack') g = rallyAll(g);
  g = endTurn(endTurn(g)); // both battle turns end -> round 2 rally
  assert.equal(g.phase, 'reinforce');
  assert.equal(g.current, 'flavio', 'round 2 opens with the second seat');
  g = endTurn(rallyAll(g)); // Flávio's full turn
  assert.equal(g.current, 'lula');
  assert.equal(g.phase, 'reinforce');
  const expected = Math.max(3, Math.floor(5 / 2)) + REGIONS.south.bonus;
  assert.equal(g.reinforcements, expected);
  assert.equal(g.reinforcements, calcReinforcements(g, 'lula').total);
});

test('eliminated factions skip both the rally and the battle', () => {
  let g = createGame('lula', seeded(5), ['flavio', 'cury'], { opener: 0 });
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
  const turns = [];
  while (g.round === 2) {
    turns.push(g.current);
    g = endTurn(rallyAll(g));
  }
  // Round 2 order is Flávio, Cury, Lula; Flávio is out.
  assert.deepEqual(turns, ['cury', 'lula'], 'Flávio has no turn either');
});

test('undo and reset give back exactly what was placed, never more', () => {
  let g = createGame('lula', seeded(6), undefined, { opener: 0 });
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
  let g = createGame('lula', seeded(7), undefined, { opener: 0 });
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
  let g = createGame('lula', rng, ['flavio', 'cury'], { opener: 0 });
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
    let g = createGame(human, rng, rivals, { spectator: true, opener: 0 });
    const deal = total(g);
    const due = g.factions.reduce((s, f) => s + calcReinforcements(g, f).total + g.openingBonus[f], 0);
    while (!g.lastRoll && g.phase !== 'over') {
      const before = g;
      g = aiStep(g, rng);
      if (g.lastRoll) assert.equal(total(before), deal + due, 'every faction rallied before the first roll');
    }
  }
});

test('attacks still work normally in the battle stage', () => {
  let g = createGame('lula', seeded(10), undefined, { opener: 0 });
  while (g.phase === 'reinforce') g = rallyAll(g);
  const from = territoriesOf(g, 'lula').find((id) => g.troops[id] >= 2 && STATE_IDS.some((t) => canAttack(g, id, t)));
  const to = STATE_IDS.find((t) => canAttack(g, from, t));
  assert.notEqual(attack(g, from, to), g);
});

test('AI decisions do not depend on which candidate is which', () => {
  // Same position, candidate names swapped: the AI must play the same moves.
  const rename = { lula: 'cury', flavio: 'caiado', cury: 'lula', caiado: 'flavio', renan: 'renan' };
  const swap = (g) => ({
    ...g,
    factions: g.factions.map((f) => rename[f]),
    owner: Object.fromEntries(Object.entries(g.owner).map(([id, f]) => [id, rename[f]])),
    current: rename[g.current],
    human: null,
    openingBonus: Object.fromEntries(Object.entries(g.openingBonus).map(([f, b]) => [rename[f], b])),
  });
  for (let seed = 1; seed <= 20; seed++) {
    let a = createGame('lula', seeded(seed), ['flavio', 'cury'], { spectator: true, opener: 0 });
    let b = swap(a);
    for (let step = 0; step < 150 && a.phase !== 'over'; step++) {
      const r1 = seeded(seed * 1000 + step);
      const r2 = seeded(seed * 1000 + step);
      a = aiStep(a, r1);
      b = aiStep(b, r2);
      assert.deepEqual(b.troops, a.troops, `seed ${seed} step ${step}: armies differ`);
      assert.deepEqual(b.owner, swap(a).owner, `seed ${seed} step ${step}: owners differ`);
    }
  }
});

test('rally marks show where each faction reinforced, until its next rally', () => {
  let g = createGame('lula', seeded(11), ['flavio'], { opener: 0 });
  const [a, b] = territoriesOf(g, 'lula');
  g = placeTroops(placeTroops(placeTroops(g, a, 2), b, 1), a, 1);
  assert.deepEqual(g.rallyMarks[a], { faction: 'lula', n: 3 });
  assert.deepEqual(g.rallyMarks[b], { faction: 'lula', n: 1 });
  g = undoPlacement(g);
  assert.equal(g.rallyMarks[a].n, 2, 'undo updates the mark');
  g = undoPlacement(undoPlacement(g));
  assert.equal(g.rallyMarks[a], undefined);
  g = rallyAll(g); // Lula confirms; Flávio rallies
  const lulaMarks = Object.values(g.rallyMarks).filter((m) => m.faction === 'lula');
  assert.equal(lulaMarks.reduce((s, m) => s + m.n, 0), calcReinforcements(createGame('lula', seeded(11), ['flavio'], { opener: 0 }), 'lula').total + g.openingBonus.lula);
  g = rallyAll(g); // Flávio done -> battle
  assert.ok(Object.values(g.rallyMarks).some((m) => m.faction === 'flavio'), "Flávio's marks visible during the battle");
  // Next round: Lula's new rally clears only Lula's old marks.
  while (!(g.round === 2 && g.current === 'lula' && g.phase === 'reinforce')) g = g.phase === 'reinforce' ? rallyAll(g) : endTurn(g);
  assert.ok(!Object.values(g.rallyMarks).some((m) => m.faction === 'lula'));
});
