import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATE_IDS } from '../src/game/data.js';
import { territoriesOf } from '../src/game/engine.js';
import {
  MAX_SIM_STEPS,
  createSimulation,
  leaderOf,
  restartSimulation,
  setSpeed,
  simulationDelay,
  stepSimulation,
  togglePause,
} from '../src/game/simulation.js';

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

const LINEUPS = [
  ['lula', 'flavio'],
  ['cury', 'renan'],
  ['lula', 'caiado', 'renan'],
  ['flavio', 'cury', 'renan', 'caiado'],
];

function runToEnd(sim, rng) {
  let s = sim;
  while (s.game.phase !== 'over' && !s.stalled) s = stepSimulation(s, rng);
  return s;
}

test('spectator games have no human and are fully automatic', () => {
  const sim = createSimulation(['lula', 'flavio', 'cury'], seeded(1));
  assert.equal(sim.game.human, null);
  assert.deepEqual([...sim.game.factions].sort(), ['cury', 'flavio', 'lula'], 'same participants, drawn order');
  assert.equal(territoriesOf(sim.game, 'lula').length + territoriesOf(sim.game, 'flavio').length + territoriesOf(sim.game, 'cury').length, 27);
});

test('simulations with 2, 3 and 4 candidates always end with one winner holding the map', () => {
  for (const lineup of LINEUPS) {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seeded(seed);
      const end = runToEnd(createSimulation(lineup, rng), rng);
      assert.equal(end.stalled, false, `${lineup} seed ${seed} stalled`);
      assert.equal(end.game.phase, 'over');
      assert.equal(end.game.log[0].type, 'victory', 'no knockout events without a human');
      assert.equal(territoriesOf(end.game, end.game.winner).length, 27);
      assert.equal(end.game.eliminated.length, lineup.length - 1);
      assert.ok(!end.game.eliminated.includes(end.game.winner));
      for (const id of STATE_IDS) assert.ok(end.game.troops[id] >= 1);
      assert.ok(end.steps < MAX_SIM_STEPS);
    }
  }
});

test('eliminations are logged in the spectator mode', () => {
  const rng = seeded(11);
  const end = runToEnd(createSimulation(['lula', 'flavio', 'cury', 'renan'], rng), rng);
  const out = end.game.log.filter((e) => e.type === 'eliminated').map((e) => e.loser);
  // The log keeps the latest 40 events, so early eliminations may scroll out; the list never does.
  assert.equal(end.game.eliminated.length, 3);
  for (const f of out) assert.ok(end.game.eliminated.includes(f));
});

test('pause stops the match and resume continues it', () => {
  const rng = seeded(3);
  let sim = createSimulation(['lula', 'flavio'], rng);
  for (let i = 0; i < 25; i++) sim = stepSimulation(sim, rng);
  const paused = togglePause(sim);
  assert.equal(paused.paused, true);
  let still = paused;
  for (let i = 0; i < 50; i++) still = stepSimulation(still, rng);
  assert.equal(still, paused, 'paused simulation does not move at all');
  const resumed = togglePause(still);
  assert.equal(resumed.paused, false);
  assert.notEqual(stepSimulation(resumed, rng).game, resumed.game);
  assert.equal(runToEnd(resumed, rng).game.phase, 'over');
});

test('speed changes the delay, restart keeps the line-up and the speed', () => {
  let sim = createSimulation(['cury', 'caiado'], seeded(5));
  const slow = simulationDelay(sim);
  sim = setSpeed(sim, 4);
  assert.equal(simulationDelay(sim), Math.round(slow / 4));
  assert.equal(setSpeed(sim, 3), sim, 'only 1x, 2x and 4x');
  const again = restartSimulation(sim, seeded(6));
  assert.deepEqual(again.factions, ['cury', 'caiado']);
  assert.equal(again.speed, 4);
  assert.equal(again.steps, 0);
  assert.notDeepEqual(again.game.owner, sim.game.owner, 'new deal');
});

test('stepping a finished match does nothing; leader is the biggest faction', () => {
  const rng = seeded(8);
  const end = runToEnd(createSimulation(['lula', 'renan', 'caiado'], rng), rng);
  assert.equal(stepSimulation(end, rng), end);
  assert.equal(leaderOf(end.game).faction, end.game.winner);
  assert.equal(leaderOf(end.game).states, 27);
});
