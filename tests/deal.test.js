import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADJACENCY, STATES, STATE_IDS } from '../src/game/data.js';
import { POLES, POLE_OPENING_BONUS, calcReinforcements, canPolarize, createGame, territoriesOf } from '../src/game/engine.js';

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
const inPole = (g, f) => territoriesOf(g, f).filter((id) => POLES[f].includes(STATES[id].region)).length;

test('polarized deal: same sizes as random, themed, fair start rules', () => {
  let lulaShare = 0;
  let flavioShare = 0;
  const deals = new Set();
  const N = 300;
  for (let seed = 1; seed <= N; seed++) {
    const human = seed % 2 ? 'lula' : 'flavio';
    const g = createGame(human, seeded(seed), [human === 'lula' ? 'flavio' : 'lula'], { deal: 'polarized' });
    assert.equal(g.deal, 'polarized');
    assert.equal(territoriesOf(g, human).length, 13);
    assert.equal(territoriesOf(g, g.factions[1]).length, 14);
    for (const f of ['lula', 'flavio']) {
      assert.equal(calcReinforcements(g, f).bonus, 0, 'nobody starts with a whole region');
      assert.ok(territoriesOf(g, f).some((id) => ADJACENCY[id].some((n) => g.owner[n] !== f)), 'attacks possible');
      assert.equal(armies(g, f), territoriesOf(g, f).length, '1 army per state, no hidden pole bonus');
    }
    lulaShare += inPole(g, 'lula') / 13.5;
    flavioShare += inPole(g, 'flavio') / 13.5;
    deals.add(territoriesOf(g, 'lula').join());
  }
  assert.ok(lulaShare / N > 0.65, `Lula mostly North/Northeast (${((100 * lulaShare) / N).toFixed(0)}%)`);
  assert.ok(flavioShare / N > 0.5, `Flávio mostly Center-South (${((100 * flavioShare) / N).toFixed(0)}%)`);
  assert.ok(deals.size > N * 0.95, 'a new deal every match');
});

test('polarized deal only applies to Lula vs. Flávio duels', () => {
  assert.equal(canPolarize(['lula', 'flavio']), true);
  assert.equal(canPolarize(['flavio', 'lula']), true);
  assert.equal(canPolarize(['lula', 'cury']), false);
  assert.equal(canPolarize(['lula', 'flavio', 'cury']), false);
  const g = createGame('lula', seeded(1), ['flavio', 'cury'], { deal: 'polarized' });
  assert.equal(g.deal, 'random', '3-4 faction matches keep the random deal');
  assert.equal(armies(g, 'lula'), 9);
});

test('random deal stays the default and unchanged', () => {
  const g = createGame('lula', seeded(2));
  assert.equal(g.deal, 'random');
  assert.equal(armies(g, 'lula'), 13);
  assert.equal(armies(g, 'flavio'), 14);
});

test('polarized duels: the North/Northeast side gets its opening bonus, by army mode', () => {
  for (const mode of [1, 2, 3, 'mixed']) {
    const pol = createGame('lula', seeded(4), ['flavio'], { deal: 'polarized', armies: mode });
    const rnd = createGame('lula', seeded(4), ['flavio'], { armies: mode });
    const base = (g, f) => territoriesOf(g, f).reduce((s, id) => s + g.troops[id], 0) + calcReinforcements(g, f).total;
    // Equal totals after the opening, then +POLE_OPENING_BONUS for Lula's side.
    const lulaTotal = base(pol, 'lula') + pol.openingBonus.lula;
    const flavioTotal = base(pol, 'flavio') + pol.openingBonus.flavio;
    assert.equal(lulaTotal - flavioTotal, POLE_OPENING_BONUS[mode], `mode ${mode}`);
    assert.equal(new Set(rnd.factions.map((f) => base(rnd, f) + rnd.openingBonus[f])).size, 1, 'random deal: no pole bonus');
  }
});
