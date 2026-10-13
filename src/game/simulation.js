// AI-vs-AI "Simular guerra" mode: the same engine and AI, with every faction
// on the computer. Pure functions so pause/speed/restart are testable.
import { createGame, territoriesOf } from './engine.js';
import { aiStep } from './ai.js';

export const SIM_SPEEDS = [1, 2, 4];
// Slightly slower than the AI in normal matches: here watching is the whole point.
const BASE_DELAY = { reinforce: 700, attack: 500, occupy: 350, fortify: 350 };
// After a notable event the next step waits a little longer (at 1x; divided by speed).
const EVENT_EXTRA = { conquer: 500, bigLoss: 300, lead: 700, region: 1000, regionLost: 1000, eliminated: 1500 };
// Safety net only: real matches end in well under 2,000 steps.
export const MAX_SIM_STEPS = 20000;

export function createSimulation(factions, rng = Math.random, speed = 1, armies = 1) {
  const game = createGame(factions[0], rng, factions.slice(1), { spectator: true, armies });
  return { factions, armies, game, paused: false, speed, steps: 0, stalled: false };
}

export function stepSimulation(sim, rng = Math.random) {
  if (sim.paused || sim.stalled || sim.game.phase === 'over') return sim;
  if (sim.steps >= MAX_SIM_STEPS) return { ...sim, stalled: true, paused: true };
  return { ...sim, game: aiStep(sim.game, rng), steps: sim.steps + 1, prevLogId: sim.game.log[0]?.id ?? 0 };
}

export const togglePause = (sim) => ({ ...sim, paused: !sim.paused });
export const setSpeed = (sim, speed) => (SIM_SPEEDS.includes(speed) ? { ...sim, speed } : sim);
// New deal with the same candidates, keeping the chosen speed.
export const restartSimulation = (sim, rng = Math.random) => createSimulation(sim.factions, rng, sim.speed, sim.armies);

export function simulationDelay(sim) {
  const latest = sim.game.log[0];
  const extra = latest && latest.id > (sim.prevLogId ?? 0) ? (EVENT_EXTRA[latest.type] ?? 0) : 0;
  return Math.round(((BASE_DELAY[sim.game.phase] ?? 500) + extra) / sim.speed);
}

// Faction holding the most states (ties: more armies).
export function leaderOf(game) {
  let best = null;
  for (const f of game.factions) {
    if (game.eliminated.includes(f)) continue;
    const lands = territoriesOf(game, f);
    const armies = lands.reduce((sum, id) => sum + game.troops[id], 0);
    if (!best || lands.length > best.states || (lands.length === best.states && armies > best.armies)) {
      best = { faction: f, states: lands.length, armies };
    }
  }
  return best;
}
