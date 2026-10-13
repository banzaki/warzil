import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_PRIORITY, nextHeldEvent } from '../src/game/highlights.js';
import { createSimulation, stepSimulation } from '../src/game/simulation.js';

const ev = (id, type) => ({ id, type });
const HOLD = 2600;

test('a shown line stays up until its time is over', () => {
  const shown = ev(1, 'conquer');
  const log = [ev(3, 'conquer'), ev(2, 'conquer'), shown];
  assert.equal(nextHeldEvent({ shown, shownAt: 0, log, now: 1000, holdMs: HOLD }), shown);
  assert.equal(nextHeldEvent({ shown, shownAt: 0, log, now: 2700, holdMs: HOLD }).id, 3, 'then the newest one');
});

test('more important events take over right away; the best one wins when time is up', () => {
  const shown = ev(1, 'conquer');
  const log = [ev(4, 'conquer'), ev(3, 'eliminated'), ev(2, 'region'), shown];
  assert.equal(nextHeldEvent({ shown, shownAt: 0, log, now: 100, holdMs: HOLD }).type, 'eliminated');
  const held = ev(3, 'eliminated');
  const later = [ev(6, 'conquer'), ev(5, 'region'), held];
  assert.equal(nextHeldEvent({ shown: held, shownAt: 0, log: later, now: 500, holdMs: HOLD }), held, 'a region does not cut an elimination short');
  assert.equal(nextHeldEvent({ shown: held, shownAt: 0, log: later, now: 2700, holdMs: HOLD }).type, 'region');
  assert.ok(EVENT_PRIORITY.victory > EVENT_PRIORITY.eliminated);
});

test('a whole simulated match keeps its full history, with rounds and lead changes', () => {
  let sim = createSimulation(['lula', 'flavio', 'cury', 'renan']);
  let conquests = 0;
  while (sim.game.phase !== 'over') {
    const before = sim.game.logCounter;
    sim = stepSimulation(sim);
    conquests += sim.game.log.filter((e) => e.id > before && e.type === 'conquer').length;
  }
  const log = sim.game.log;
  assert.equal(log.filter((e) => e.type === 'conquer').length, conquests, 'no conquest dropped from the diary');
  // The last knock-out is logged as the victory itself.
  assert.equal(log.filter((e) => e.type === 'eliminated').length, 2);
  assert.equal(log[0].type, 'victory');
  assert.equal(sim.game.eliminated.length, 3);
  for (const e of log) assert.ok(Number.isInteger(e.round) && e.round >= 1);
  for (const e of log.filter((x) => x.type === 'lead')) {
    assert.notEqual(e.faction, e.previous);
    assert.ok(e.round >= 2);
  }
});
