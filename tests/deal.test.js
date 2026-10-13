import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADJACENCY, STATES, STATE_IDS } from '../src/game/data.js';
import { POLES, POLE_ARMY_BONUS, STARTING_TROOPS, calcReinforcements, canPolarize, createGame, territoriesOf } from '../src/game/engine.js';

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
      assert.equal(armies(g, f), STARTING_TROOPS[2] + POLE_ARMY_BONUS[f]);
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
  assert.equal(armies(g, 'lula'), STARTING_TROOPS[3]);
});

test('random deal stays the default and unchanged', () => {
  const g = createGame('lula', seeded(2));
  assert.equal(g.deal, 'random');
  assert.equal(armies(g, 'lula'), 40);
  assert.equal(armies(g, 'flavio'), 40);
});
