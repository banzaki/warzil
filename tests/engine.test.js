import { test } from 'node:test';
import assert from 'node:assert/strict';
import brazil from '@svg-maps/brazil';
import { ADJACENCY, STATES, STATE_IDS } from '../src/game/data.js';
import {
  attack,
  attackerDiceCount,
  blitz,
  calcReinforcements,
  canAttack,
  canFortify,
  createGame,
  defenderDiceCount,
  endAttack,
  endTurn,
  finishRally,
  fortify,
  movableTroops,
  occupy,
  placeTroops,
  territoriesOf,
} from '../src/game/engine.js';
import { aiStep } from '../src/game/ai.js';

// Deterministic RNG so failures are reproducible.
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

// RNG that yields the given die faces in order (1..6), for scripted rolls.
const dice = (...faces) => {
  let i = 0;
  return () => (faces[i++ % faces.length] - 1) / 6 + 0.01;
};

function assertInvariants(state) {
  for (const id of STATE_IDS) {
    assert.ok(state.troops[id] >= 1, `${id} has ${state.troops[id]} troops`);
    assert.ok(state.factions.includes(state.owner[id]), `${id} owned by ${state.owner[id]}`);
  }
}

// A hand-built board: Lula owns everything except the listed Flávio states.
function board({ flavio = [], troops = {}, phase = 'attack' } = {}) {
  const g = createGame('lula', seeded(1), undefined, { fixedOrder: true });
  const owner = Object.fromEntries(STATE_IDS.map((id) => [id, flavio.includes(id) ? 'flavio' : 'lula']));
  const t = Object.fromEntries(STATE_IDS.map((id) => [id, 1]));
  return { ...g, owner, troops: { ...t, ...troops }, phase, current: 'lula', reinforcements: 0, movedOut: {}, received: {} };
}

// ---------- Board integrity ----------

test('board has 27 territories matching the SVG map', () => {
  assert.equal(STATE_IDS.length, 27);
  const mapIds = brazil.locations.map((l) => l.id).sort();
  assert.deepEqual([...STATE_IDS].sort(), mapIds);
});

test('adjacency is symmetric and the graph is connected', () => {
  for (const [a, list] of Object.entries(ADJACENCY)) {
    for (const b of list) assert.ok(ADJACENCY[b].includes(a), `${a}-${b} not symmetric`);
  }
  const seen = new Set(['sp']);
  const queue = ['sp'];
  while (queue.length) for (const n of ADJACENCY[queue.shift()]) if (!seen.has(n)) seen.add(n), queue.push(n);
  assert.equal(seen.size, 27);
  assert.ok(STATES.df && ADJACENCY.df.includes('go'));
});

test('new game splits the map 13/14 with 1 army per state (v0.6 default)', () => {
  const g = createGame('lula', seeded(1));
  assert.equal(territoriesOf(g, 'lula').length, 13);
  assert.equal(territoriesOf(g, 'flavio').length, 14);
  for (const id of STATE_IDS) assert.equal(g.troops[id], 1);
  assert.equal(g.current, 'lula');
  assert.equal(g.phase, 'reinforce');
  // Opening compensation: 13 armies + 6 reinforcements vs. 14 + 7 -> Lula gets +2.
  assert.deepEqual(g.openingBonus, { lula: 2, flavio: 0 });
  assert.equal(g.reinforcements, calcReinforcements(g, 'lula').total + 2);
  assertInvariants(g);
});

test('nobody starts with a complete region', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const g = createGame('lula', seeded(seed));
    assert.equal(calcReinforcements(g, 'lula').bonus, 0, `seed ${seed}`);
    assert.equal(calcReinforcements(g, 'flavio').bonus, 0, `seed ${seed}`);
  }
});

// ---------- Dice ----------

test('dice counts for 1, 2, 3, 4 and 15 armies', () => {
  assert.deepEqual([1, 2, 3, 4, 15].map(attackerDiceCount), [0, 1, 2, 3, 3]);
  assert.deepEqual([1, 2, 3, 4, 15].map(defenderDiceCount), [1, 2, 3, 3, 3]);

  // Same thing through a real attack (sp -> pr), all sixes vs ones.
  for (const [armies, expected] of [[2, 1], [3, 2], [4, 3], [15, 3]]) {
    const g = attack(board({ flavio: ['pr'], troops: { sp: armies, pr: 15 } }), 'sp', 'pr', dice(6));
    assert.equal(g.lastRoll.attackerDice.length, expected, `${armies} armies`);
    assert.equal(g.lastRoll.defenderDice.length, 3);
  }
  // 1 army cannot attack at all.
  const g1 = board({ flavio: ['pr'], troops: { sp: 1, pr: 1 } });
  assert.equal(canAttack(g1, 'sp', 'pr'), false);
  assert.equal(attack(g1, 'sp', 'pr', dice(6)), g1);
});

test('dice are compared high to low in pairs, ties go to the defender', () => {
  const g = board({ flavio: ['pr'], troops: { sp: 10, pr: 10 } });
  // Attacker 6,4,2 vs defender 5,4,3 (rolled out of order on purpose).
  const r = attack(g, 'sp', 'pr', dice(2, 6, 4, 3, 5, 4));
  assert.deepEqual(r.lastRoll.attackerDice, [6, 4, 2]);
  assert.deepEqual(r.lastRoll.defenderDice, [5, 4, 3]);
  // 6>5 wins, 4=4 tie -> defender, 2<3 loses.
  assert.equal(r.lastRoll.defenderLoss, 1);
  assert.equal(r.lastRoll.attackerLoss, 2);
  assert.equal(r.troops.sp, 8);
  assert.equal(r.troops.pr, 9);

  // All ties: attacker loses every pair.
  const t = attack(g, 'sp', 'pr', dice(4));
  assert.equal(t.troops.sp, 7);
  assert.equal(t.troops.pr, 10);

  // Fewer attacker dice: only that many pairs are compared.
  const one = attack(board({ flavio: ['pr'], troops: { sp: 2, pr: 3 } }), 'sp', 'pr', dice(6, 1, 1, 1));
  assert.equal(one.lastRoll.defenderLoss + one.lastRoll.attackerLoss, 1);
});

// ---------- Battle phase ----------

test('many attacks in one turn, same selection kept between rolls', () => {
  let g = board({ flavio: ['pr', 'mg'], troops: { sp: 30, pr: 20, mg: 20 } });
  for (let i = 0; i < 8; i++) {
    g = attack(g, 'sp', 'pr', dice(1)); // attacker always loses: 3 per roll
    if (i < 8 && g.troops.sp >= 2) {
      assert.equal(g.selected, 'sp');
      assert.equal(g.target, 'pr');
    }
  }
  assert.equal(g.troops.sp, 6);
  // Can still switch to another valid target in the same phase.
  g = attack(g, 'sp', 'mg', dice(6, 6, 6, 1, 1, 1));
  assert.equal(g.troops.mg, 17);
  assert.equal(g.phase, 'attack');
});

test('conquest: minimum = dice of the final roll, choose up to all but one', () => {
  const g = board({ flavio: ['pr', 'sc'], troops: { sp: 10, pr: 1, sc: 2 } });
  const c = attack(g, 'sp', 'pr', dice(6, 6, 6, 1));
  assert.equal(c.owner.pr, 'lula');
  assert.equal(c.lastRoll.conquered, true);
  assert.equal(c.phase, 'occupy');
  assert.deepEqual(c.pendingOccupy, { from: 'sp', to: 'pr', min: 3, max: 9 });
  assert.equal(c.troops.pr, 3);
  assert.equal(c.troops.sp, 7);

  const minimum = occupy(c, 3);
  assert.equal(minimum.troops.pr, 3);
  assert.equal(minimum.troops.sp, 7);

  const maximum = occupy(c, 9);
  assert.equal(maximum.troops.pr, 9);
  assert.equal(maximum.troops.sp, 1);

  // Out-of-range requests are clamped to the legal range.
  assert.equal(occupy(c, 1).troops.pr, 3);
  assert.equal(occupy(c, 99).troops.sp, 1);

  // Conquered state can keep attacking right away.
  assert.equal(maximum.phase, 'attack');
  assert.equal(maximum.selected, 'pr');
  assert.ok(canAttack(maximum, 'pr', 'sc'));
});

test('conquest with exactly enough armies skips the choice, origin keeps 1', () => {
  // 2 armies -> 1 die -> must move 1, nothing left to choose.
  const c = attack(board({ flavio: ['pr', 'rs'], troops: { sp: 2, pr: 1 } }), 'sp', 'pr', dice(6, 1));
  assert.equal(c.owner.pr, 'lula');
  assert.equal(c.phase, 'attack');
  assert.equal(c.troops.sp, 1);
  assert.equal(c.troops.pr, 1);
});

test('consecutive conquests in one turn', () => {
  let g = board({ flavio: ['pr', 'sc', 'rs'], troops: { sp: 20, pr: 1, sc: 1, rs: 1, ms: 1 } });
  g = blitz(g, 'sp', 'pr', dice(6, 1));
  g = occupy(g, 99);
  g = blitz(g, 'pr', 'sc', dice(6, 1));
  g = occupy(g, 99);
  g = blitz(g, 'sc', 'rs', dice(6, 1));
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 'lula');
  assert.equal(endTurn(g), g);
});

// ---------- Movement ----------
// v0.8 rule: a state may send to several neighbours in several transfers; each
// army moves once per movement phase; received armies stay; 1 army stays home.

test('one origin, several transfers to different neighbours (v0.8)', () => {
  let g = board({ flavio: ['rs'], troops: { sp: 10, mg: 4, pr: 1 }, phase: 'fortify' });
  g = fortify(g, 'sp', 'mg', 5);
  assert.equal(g.troops.sp, 5);
  assert.equal(g.troops.mg, 9);
  assert.equal(g.phase, 'fortify', 'moving does not end the turn');
  assert.equal(g.selected, 'sp', 'origin stays selected while it can still send');
  // SP may still send its remaining own armies to another neighbour, keeping 1.
  assert.equal(movableTroops(g, 'sp'), 4);
  g = fortify(g, 'sp', 'pr', 4);
  assert.equal(g.troops.sp, 1);
  assert.equal(g.troops.pr, 5);
  assert.equal(g.selected, null);
  assert.equal(movableTroops(g, 'sp'), 0);
  assert.equal(fortify(g, 'sp', 'rj', 1), g, 'nothing left to send');
  assert.equal(g.movedOut.sp, 9);
});

test('received armies cannot be chained onward', () => {
  let g = board({ flavio: ['rs'], troops: { sp: 10, mg: 1 }, phase: 'fortify' });
  g = fortify(g, 'sp', 'mg', 9);
  assert.equal(g.troops.mg, 10);
  // Only MG's own single army may leave; asking for more is refused.
  assert.equal(movableTroops(g, 'mg'), 1);
  assert.equal(fortify(g, 'mg', 'go', 2), g, 'cannot send received armies');
  g = fortify(g, 'mg', 'go', 1);
  assert.equal(g.troops.mg, 9, 'all 9 received armies stay');
  assert.equal(g.troops.go, 2);
  assert.equal(canFortify(g, 'mg', 'df'), false, 'MG has no own armies left');
  // GO got 1: its own army may go on, the received one stays.
  assert.equal(movableTroops(g, 'go'), 1);
});

// ---------- Movement: own vs. received armies (v0.4 fix) ----------

test('reported bug: a state that received armies can still move its own', () => {
  // MG starts with 3 of its own and receives 5 from SP.
  let g = board({ flavio: ['rs'], troops: { sp: 6, mg: 3 }, phase: 'fortify' });
  g = fortify(g, 'sp', 'mg', 5);
  assert.equal(movableTroops(g, 'mg'), 3, 'all 3 own armies, one received stays behind');
  g = fortify(g, 'mg', 'go', 3);
  assert.equal(g.troops.mg, 5);
  assert.equal(g.troops.go, 4);

  // Single own army + received: the own one may still leave.
  let h = board({ flavio: ['rs'], troops: { sp: 6, mg: 1 }, phase: 'fortify' });
  h = fortify(h, 'sp', 'mg', 5);
  assert.equal(movableTroops(h, 'mg'), 1);
});

test('own armies stay limited after receiving several transfers', () => {
  let g = board({ flavio: ['rs'], troops: { sp: 4, rj: 4, mg: 2 }, phase: 'fortify' });
  g = fortify(g, 'sp', 'mg', 3);
  g = fortify(g, 'rj', 'mg', 3);
  assert.equal(g.troops.mg, 8);
  assert.equal(g.received.mg, 6);
  assert.equal(movableTroops(g, 'mg'), 2, 'only the 2 that were already there');
  // A state with no own armies left to spare: receive-only origin cannot move.
  let h = board({ flavio: ['rs'], troops: { sp: 3, mg: 1 }, phase: 'fortify' });
  h = fortify(h, 'mg', 'go', 1); // MG cannot leave with 1 army
  assert.equal(h.troops.mg, 1);
});

test('origin and destination restrictions', () => {
  let g = board({ flavio: ['pr'], troops: { sp: 6, mg: 6 }, phase: 'fortify' });
  g = fortify(g, 'sp', 'mg', 2);
  // MG sends its own 6 back: SP now holds 4 own + 6 received.
  g = fortify(g, 'mg', 'sp', 6);
  assert.equal(g.troops.sp, 10);
  assert.equal(g.troops.mg, 2, 'MG keeps the 2 it received');
  // SP's own 4 may still go; the 6 that came from MG may not move again.
  assert.equal(movableTroops(g, 'sp'), 4);
  assert.equal(fortify(g, 'sp', 'rj', 5), g);
  // Never to an enemy or non-neighbour, never from an enemy state.
  assert.equal(canFortify(g, 'rj', 'pr'), false);
  assert.equal(canFortify(g, 'rj', 'ba'), false);
  assert.equal(canFortify(g, 'pr', 'sc'), false);
});

test('random movement sequences never create, lose or chain armies', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = seeded(seed);
    const troops = Object.fromEntries(STATE_IDS.map((id) => [id, 1 + Math.floor(rng() * 6)]));
    let g = board({ flavio: ['rs', 'ap'], troops, phase: 'fortify' });
    const start = { ...g.troops };
    const sum = (t) => STATE_IDS.reduce((s, id) => s + t[id], 0);
    const outflow = {};
    for (let i = 0; i < 40; i++) {
      const from = STATE_IDS[Math.floor(rng() * 27)];
      const to = ADJACENCY[from][Math.floor(rng() * ADJACENCY[from].length)];
      const before = g;
      g = fortify(g, from, to, 1 + Math.floor(rng() * 8));
      if (g !== before) outflow[from] = (outflow[from] ?? 0) + (before.troops[from] - g.troops[from]);
    }
    assert.equal(sum(g.troops), sum(start), `seed ${seed}: total changed`);
    for (const id of STATE_IDS) {
      assert.ok(g.troops[id] >= 1, `seed ${seed}: ${id} emptied`);
      // A state never sends more than the armies it had before anything arrived.
      if (outflow[id]) assert.ok(outflow[id] <= start[id], `seed ${seed}: ${id} sent ${outflow[id]} of its own ${start[id]}`);
    }
  }
});

test('movement rejects enemy, non-adjacent and emptying moves', () => {
  const g = board({ flavio: ['pr'], troops: { sp: 5, ba: 5 }, phase: 'fortify' });
  assert.equal(canFortify(g, 'sp', 'pr'), false, 'enemy');
  assert.equal(canFortify(g, 'sp', 'ba'), false, 'not adjacent');
  assert.equal(fortify(g, 'sp', 'mg', 5), g, 'origin keeps 1: 5 of 5 is refused');
  assert.equal(fortify(g, 'sp', 'mg', 4).troops.sp, 1);
  for (const bad of [0, -1, 1.5, '2', null]) assert.equal(fortify(g, 'sp', 'mg', bad), g, `amount ${bad}`);
  assert.equal(canFortify(board({ troops: { sp: 1 }, phase: 'fortify' }), 'sp', 'mg'), false);
  assert.equal(canFortify({ ...g, phase: 'attack' }, 'sp', 'mg'), false, 'only in movement phase');
});

test('movement limits reset next turn', () => {
  let g = board({ flavio: ['rs'], troops: { sp: 10, mg: 1, rs: 1 }, phase: 'fortify' });
  g = fortify(g, 'sp', 'mg', 9);
  g = endTurn(g); // Flávio
  g = endTurn(endAttack({ ...g, phase: 'attack' })); // back to Lula
  assert.deepEqual(g.movedOut, {});
  assert.deepEqual(g.received, {});
});

// ---------- Full turns & AI ----------

test('reinforce -> attack -> occupy -> move -> AI turn', () => {
  const rng = seeded(7);
  let g = createGame('flavio', rng, undefined, { fixedOrder: true });
  const mine = territoriesOf(g, 'flavio');
  const from = mine.find((id) => ADJACENCY[id].some((n) => g.owner[n] === 'lula'));
  const to = ADJACENCY[from].find((n) => g.owner[n] === 'lula');
  g = placeTroops(g, from, 999);
  assert.equal(g.reinforcements, 0);
  // v0.5 collective rally: placing everything does not start the battle by itself.
  assert.equal(g.phase, 'reinforce');
  g = finishRally(g, rng);
  assert.equal(g.current, 'lula', 'the AI rallies next');
  assert.equal(g.phase, 'reinforce');
  while (g.phase === 'reinforce') g = aiStep(g, rng);
  assert.equal(g.current, 'flavio', 'battle starts with the first faction');
  assert.equal(g.phase, 'attack');

  const own = mine.find((id) => id !== from);
  assert.equal(attack(g, from, own, rng), g);

  g = { ...g, troops: { ...g.troops, [from]: 30, [to]: 1 } };
  g = blitz(g, from, to, rng);
  assert.equal(g.owner[to], 'flavio');
  assert.equal(g.phase, 'occupy');
  g = occupy(g, 5);
  assert.equal(g.phase, 'attack');
  assertInvariants(g);

  g = endAttack(g);
  assert.equal(g.phase, 'fortify');
  g = fortify(g, from, to, 3);
  g = endTurn(g, rng);
  assert.equal(g.current, 'lula');
  assert.equal(g.phase, 'attack', 'the AI already rallied this round');

  let steps = 0;
  // Lula's battle turn, until the round-2 rally begins.
  while (g.phase !== 'reinforce' && g.phase !== 'over' && steps++ < 1000) g = aiStep(g, rng);
  assert.ok(steps < 1000, 'AI turn did not finish');
  if (g.phase !== 'over') {
    assert.equal(g.current, 'flavio', 'round 2 opens with the first seat again (fixed order)');
    assert.equal(g.phase, 'reinforce', 'new round starts with the rally');
    assert.equal(g.round, 2);
  }
  assertInvariants(g);
});

test('AI follows the same movement rules', () => {
  // Interior SP and MG both want to push to the front; AI must not chain.
  const rng = seeded(5);
  let g = board({ flavio: ['rs', 'sc', 'pr'], troops: { sp: 10, ms: 5, rs: 1, sc: 1, pr: 1 }, phase: 'fortify' });
  g = { ...g, current: 'lula' };
  const before = { ...g.troops };
  let steps = 0;
  const seen = [];
  while (g.current === 'lula' && steps++ < 100) {
    const prev = g;
    g = aiStep(g, rng);
    if (g.current === 'lula') {
      const from = STATE_IDS.find((id) => g.movedOut[id] && !prev.movedOut[id]);
      assert.ok(from, 'each AI step is one legal move');
      assert.ok(!seen.includes(from), 'state moved out twice');
      seen.push(from);
    }
  }
  assert.ok(steps < 100);
  const total = (t) => STATE_IDS.reduce((s, id) => s + t[id], 0);
  assert.equal(total(g.troops), total(before), 'no armies created or lost');
});

test('AI vs AI games always reach a winner', () => {
  const wins = { lula: 0, flavio: 0 };
  for (let seed = 1; seed <= 200; seed++) {
    const rng = seeded(seed);
    let g = createGame(seed % 2 ? 'lula' : 'flavio', rng);
    let steps = 0;
    while (g.phase !== 'over' && steps++ < 30000) {
      const prevPhase = g.phase;
      g = aiStep(g, rng);
      if (prevPhase !== 'occupy' && steps % 25 === 0) assertInvariants(g);
    }
    assert.equal(g.phase, 'over', `seed ${seed} never finished (turn ${g.turn})`);
    assert.equal(territoriesOf(g, g.winner).length, 27);
    wins[g.winner]++;
  }
  assert.equal(wins.lula + wins.flavio, 200);
});

// ---------- Multi-faction (v0.3) ----------

const total = (g, f) => territoriesOf(g, f).reduce((s, id) => s + g.troops[id], 0);

test('deal for 3 and 4 factions: territories and armies', () => {
  const g3 = createGame('flavio', seeded(2), ['lula', 'cury'], { fixedOrder: true });
  assert.deepEqual(g3.factions, ['flavio', 'lula', 'cury']);
  for (const f of g3.factions) {
    assert.equal(territoriesOf(g3, f).length, 9);
    assert.equal(total(g3, f), 9, '1 army per state');
    assert.equal(g3.openingBonus[f], 0, 'even split: no compensation');
  }
  const g4 = createGame('lula', seeded(3), ['flavio', 'renan', 'caiado'], { fixedOrder: true });
  assert.deepEqual(g4.factions.map((f) => territoriesOf(g4, f).length), [7, 7, 7, 6]);
  for (const f of g4.factions) assert.equal(total(g4, f), territoriesOf(g4, f).length);
  // The 6-state seat gets +1 so that armies + first reinforcements match (7+3 vs 6+3).
  assert.deepEqual(g4.factions.map((f) => g4.openingBonus[f]), [0, 0, 0, 1]);
  for (let seed = 1; seed <= 200; seed++) {
    const g = createGame('lula', seeded(seed), ['flavio', 'renan', 'caiado']);
    for (const f of g.factions) assert.equal(calcReinforcements(g, f).bonus, 0, `seed ${seed}`);
  }
  assertInvariants(g4);
});

// Rally everybody (all armies on their first state), or end the battle turn.
function advance(g) {
  if (g.phase !== 'reinforce') return endTurn(g);
  const first = territoriesOf(g, g.current)[0];
  return finishRally(placeTroops(g, first, g.reinforcements));
}

test('turn order cycles through factions and counts rounds', () => {
  let g = createGame('lula', seeded(4), ['flavio', 'cury'], { fixedOrder: true });
  const seen = [];
  for (let i = 0; i < 12; i++) {
    seen.push([g.phase === 'reinforce' ? 'rally' : 'battle', g.current, g.round]);
    g = advance(g);
  }
  assert.deepEqual(seen, [
    // Round 1: collective preparation, then battles.
    ['rally', 'lula', 1], ['rally', 'flavio', 1], ['rally', 'cury', 1],
    ['battle', 'lula', 1], ['battle', 'flavio', 1], ['battle', 'cury', 1],
    // Round 2: full turns in the same fixed order (v0.7.1: no rotation).
    ['rally', 'lula', 2], ['battle', 'lula', 2],
    ['rally', 'flavio', 2], ['battle', 'flavio', 2],
    ['rally', 'cury', 2], ['battle', 'cury', 2],
  ]);
});

test('eliminated factions are skipped; the match goes on', () => {
  let g = board({ flavio: ['rs'], troops: { sc: 10, rs: 1 } });
  g = { ...g, factions: ['lula', 'flavio', 'cury'], owner: { ...g.owner, am: 'cury' } };
  g = blitz(g, 'sc', 'rs', dice(6, 1));
  assert.deepEqual(g.eliminated, ['flavio']);
  assert.notEqual(g.phase, 'over');
  assert.equal(g.log[0].type, 'eliminated');
  g = endTurn(occupy(g, 1));
  assert.equal(g.current, 'cury', 'flavio is skipped');
  g = endTurn(g);
  // Round 2 opens with the first seat again (fixed order): Lula.
  assert.equal(g.current, 'lula');
  assert.equal(g.phase, 'reinforce');
  assert.equal(g.round, 2);
});

test('victory only when a single faction survives', () => {
  let g = board({ flavio: ['rs'], troops: { sc: 10, rs: 1, pr: 10, ap: 1 } });
  g = { ...g, factions: ['lula', 'flavio', 'cury'], owner: { ...g.owner, ap: 'cury' } };
  g = occupy(blitz(g, 'sc', 'rs', dice(6, 1)), 1);
  assert.equal(g.phase, 'attack');
  g = blitz({ ...g, troops: { ...g.troops, pa: 10 } }, 'pa', 'ap', dice(6, 1));
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 'lula');
  assert.equal(g.log[0].type, 'victory');
});

test('human losing the last state ends the match at once', () => {
  // Cury attacks the human's only state while Flávio is still alive.
  const owner = Object.fromEntries(STATE_IDS.map((id) => [id, 'cury']));
  owner.rs = 'lula';
  owner.am = 'flavio';
  let g = board();
  g = { ...g, owner, factions: ['lula', 'flavio', 'cury'], current: 'cury', troops: { ...g.troops, sc: 10, rs: 1 } };
  g = blitz(g, 'sc', 'rs', dice(6, 1));
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 'cury');
  assert.equal(g.log[0].type, 'knockout');
  assert.equal(g.log[0].loser, 'lula');
});

test('defender colour comes from the real owner', () => {
  let g = board({ flavio: ['pr'], troops: { sp: 5, pr: 5 } });
  g = { ...g, factions: ['lula', 'flavio', 'cury'], owner: { ...g.owner, mg: 'cury' } };
  assert.equal(attack(g, 'sp', 'mg', dice(3)).lastRoll.defender, 'cury');
  assert.equal(attack(g, 'sp', 'pr', dice(3)).lastRoll.defender, 'flavio');
});

test('AI-only matches with 3 and 4 factions always finish', () => {
  for (const rivals of [['flavio', 'cury'], ['flavio', 'renan', 'caiado']]) {
    for (let seed = 1; seed <= 150; seed++) {
      const rng = seeded(seed);
      let g = createGame('lula', rng, rivals);
      let steps = 0;
      while (g.phase !== 'over' && steps++ < 30000) {
        const prevPhase = g.phase;
        g = aiStep(g, rng);
        if (prevPhase !== 'occupy' && steps % 25 === 0) assertInvariants(g);
      }
      assert.equal(g.phase, 'over', `${rivals.length + 1} factions, seed ${seed} never finished`);
      assert.ok(['victory', 'knockout'].includes(g.log[0].type));
      if (g.log[0].type === 'victory') assert.equal(territoriesOf(g, g.winner).length, 27);
      else assert.equal(territoriesOf(g, 'lula').length, 0);
    }
  }
});

test('the turn order is drawn once: unbiased, unique positions, independent of the player', () => {
  const counts = {};
  const N = 8000;
  const rng = seeded(99);
  for (let k = 0; k < N; k++) {
    const g = createGame('lula', rng, ['flavio', 'cury', 'renan']);
    assert.deepEqual([...g.factions].sort(), ['cury', 'flavio', 'lula', 'renan'], 'every participant exactly once');
    g.factions.forEach((f, pos) => {
      counts[`${f}@${pos}`] = (counts[`${f}@${pos}`] ?? 0) + 1;
    });
    assert.equal(g.current, g.factions[0], 'the first drawn opens the opening rally');
  }
  // Each candidate lands in each position ~1/4 of the time (the player too).
  for (const f of ['lula', 'flavio', 'cury', 'renan']) {
    for (let pos = 0; pos < 4; pos++) {
      const share = counts[`${f}@${pos}`] / N;
      assert.ok(Math.abs(share - 0.25) < 0.025, `${f} in position ${pos + 1}: ${(share * 100).toFixed(1)}%`);
    }
  }
});

test('the drawn order stays fixed for the whole match', () => {
  let g = createGame('renan', seeded(4), ['lula', 'caiado', 'flavio']);
  const order = [...g.factions];
  const turns = [];
  while (g.round <= 3) {
    if (g.phase !== 'reinforce') turns.push(g.current);
    g = advance(g);
  }
  assert.deepEqual(g.factions, order, 'order never changes');
  assert.deepEqual(turns, [...order, ...order, ...order], 'every round follows the same order');
});
