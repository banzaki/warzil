import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_DELAY, EVENT_EXTRA, SPEED_FACTOR, aiDelay } from '../src/game/pace.js';
import { createGame } from '../src/game/engine.js';
import { createSimulation, simulationDelay, stepSimulation } from '../src/game/simulation.js';

import { seededRng } from '../src/game/daily.js';

// A constant rng would deal the same map forever (re-deal loop); use a seeded one.
const game = (phase, latest) => ({ ...createGame('lula', seededRng(42)), phase, log: latest ? [latest] : [] });

test('speeds are exactly 1x, 2x and 4x of Normal', () => {
  const g = game('attack');
  const normal = aiDelay(g, 0, 'normal');
  assert.equal(aiDelay(g, 0, 'fast'), normal / 2, 'Rápida = 2x (the default)');
  assert.equal(aiDelay(g, 0, 'veryFast'), normal / 4, 'Muito rápida = 4x');
  assert.ok(normal >= 1000, 'Normal attack step >= 1 s');
});

test('important events get more time, and only once', () => {
  const conquest = { id: 10, type: 'conquer' };
  const elimination = { id: 11, type: 'eliminated' };
  const roll = aiDelay(game('attack'), 0, 'normal');
  const afterConquest = aiDelay(game('attack', conquest), 9, 'normal');
  const afterElimination = aiDelay(game('attack', elimination), 10, 'normal');
  assert.equal(afterConquest - roll, EVENT_EXTRA.conquer);
  assert.ok(afterElimination > afterConquest);
  assert.equal(aiDelay(game('attack', conquest), 10, 'normal'), roll, 'already seen: no extra');
  assert.equal(BASE_DELAY.attack * SPEED_FACTOR.normal, roll);
});

test('simulation: conquests and eliminations hold the next step a bit longer', () => {
  let sim = createSimulation(['lula', 'flavio']);
  let sawExtra = false;
  for (let i = 0; i < 2000 && sim.game.phase !== 'over'; i++) {
    sim = stepSimulation(sim);
    const latest = sim.game.log[0];
    if (latest.type === 'conquer' && latest.id > sim.prevLogId) {
      assert.ok(simulationDelay(sim) > 500, 'extra time after a conquest');
      sawExtra = true;
      break;
    }
  }
  assert.ok(sawExtra);
});
