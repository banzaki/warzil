import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATE_IDS } from '../src/game/data.js';
import { ARMY_MODES, calcReinforcements, createGame, endTurn, finishRally, placeTroops, territoriesOf } from '../src/game/engine.js';

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
const armies = (g, f) => territoriesOf(g, f).reduce((s, id) => s + g.troops[id], 0);
const LINEUPS = [['lula', ['flavio']], ['flavio', ['lula', 'cury']], ['renan', ['lula', 'flavio', 'caiado']]];
// Armies on the map + everything received in the opening rally.
const afterOpening = (g, f) => armies(g, f) + calcReinforcements(g, f).total + g.openingBonus[f];

test('uniform modes: exactly 1, 2 or 3 armies on every state', () => {
  for (const mode of [1, 2, 3]) {
    for (const [human, rivals] of LINEUPS) {
      const g = createGame(human, seeded(1), rivals, { armies: mode });
      assert.equal(g.armies, mode);
      for (const id of STATE_IDS) assert.equal(g.troops[id], mode);
    }
  }
  assert.equal(createGame('lula', seeded(1)).armies, 1, '1 per state is the default');
  assert.equal(createGame('lula', seeded(1), undefined, { armies: 9 }).armies, 1, 'unknown modes fall back to 1');
});

test('mixed mode: 1-5 per state, same budget for everybody, varies between matches', () => {
  const layouts = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    for (const [human, rivals] of LINEUPS) {
      const g = createGame(human, seeded(seed), rivals, { armies: 'mixed' });
      for (const id of STATE_IDS) assert.ok(g.troops[id] >= 1 && g.troops[id] <= 5, `${id}=${g.troops[id]}`);
      const totals = g.factions.map((f) => armies(g, f));
      assert.equal(new Set(totals).size, 1, `equal budgets, got ${totals}`);
      const most = Math.max(...g.factions.map((f) => territoriesOf(g, f).length));
      assert.equal(totals[0], 3 * most, 'budget = 3 x the largest holding');
      layouts.add(JSON.stringify(g.troops));
    }
  }
  assert.equal(layouts.size, 600, 'a different layout every match');
});

test('opening compensation: everybody has the same total after the opening rally', () => {
  for (const mode of ARMY_MODES) {
    for (let seed = 1; seed <= 100; seed++) {
      for (const [human, rivals] of LINEUPS) {
        const g = createGame(human, seeded(seed), rivals, { armies: mode });
        const totals = g.factions.map((f) => afterOpening(g, f));
        assert.equal(new Set(totals).size, 1, `${mode}: ${totals}`);
        for (const f of g.factions) assert.ok(g.openingBonus[f] >= 0);
      }
    }
  }
});

test('compensation is paid only in the opening rally', () => {
  let g = createGame('lula', seeded(3), undefined, { opener: 0 });
  assert.ok(g.openingBonus.lula > 0, 'the 13-state side is compensated');
  assert.equal(g.reinforcements, calcReinforcements(g, 'lula').total + g.openingBonus.lula);
  // Play round 1 (everything on the first state, no attacks) until Lula's round-2 rally.
  while (!(g.round === 2 && g.current === 'lula' && g.phase === 'reinforce')) {
    g = g.phase === 'reinforce' ? finishRally(placeTroops(g, territoriesOf(g, g.current)[0], g.reinforcements)) : endTurn(g);
  }
  assert.equal(g.reinforcements, calcReinforcements(g, 'lula').total, 'round 2 uses the normal formula');
});

test('the starting deal stays fair: no complete region, attacks possible in every mode', () => {
  for (const mode of ARMY_MODES) {
    for (let seed = 1; seed <= 100; seed++) {
      const g = createGame('lula', seeded(seed), ['flavio', 'cury', 'renan'], { armies: mode });
      for (const f of g.factions) assert.equal(calcReinforcements(g, f).bonus, 0);
    }
  }
});
