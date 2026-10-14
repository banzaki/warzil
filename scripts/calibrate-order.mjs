// Calibrates the turn-position compensation (POSITION_BONUS in engine.js) with
// AI-only matches. The turn order is drawn once and fixed; each position gets a
// fixed number of extra reinforcements in the opening rally only.
//
// Usage: node scripts/calibrate-order.mjs <size> <armies> [deal] [N] [start]
//   size 2|3|4, armies 1|2|3|mixed, deal random|polarized, N matches per step,
//   start: comma list to begin the search from (default all zeros).
// Prints every step and, at the end, the best row confirmed with 4N matches.
// The search: measure win rate by position; give +1 to the weakest position, or
// take 1 from the strongest one when it already has a bonus. Stops when the gap
// between positions is <= TARGET_GAP points, or after MAX_STEPS.
import { createGame } from '../src/game/engine.js';
import { aiStep } from '../src/game/ai.js';

const size = Number(process.argv[2] ?? 2);
const armiesArg = process.argv[3] ?? '1';
const armies = armiesArg === 'mixed' ? 'mixed' : Number(armiesArg);
const deal = process.argv[4] ?? 'random';
const N = Number(process.argv[5] ?? 1500);
const start = process.argv[6] ? process.argv[6].split(',').map(Number) : Array(size).fill(0);
const TARGET_GAP = 3;
const MAX_STEPS = 14;
const ALL = ['lula', 'flavio', 'cury', 'renan', 'caiado'];

const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Win rate (%) by position, plus side balance for the polarized duel.
function measure(bonus, n) {
  const wins = Array(size).fill(0);
  let lulaWins = 0;
  const rounds = [];
  for (let i = 0; i < n; i++) {
    const lineup = deal === 'polarized' ? ['lula', 'flavio'] : shuffle(ALL).slice(0, size);
    let g = createGame(lineup[0], Math.random, lineup.slice(1), { spectator: true, deal, armies, positionBonus: bonus });
    let steps = 0;
    while (g.phase !== 'over' && steps++ < 60000) g = aiStep(g);
    wins[g.factions.indexOf(g.winner)]++;
    if (g.winner === 'lula') lulaWins++;
    rounds.push(g.round);
  }
  rounds.sort((a, b) => a - b);
  const rates = wins.map((w) => (100 * w) / n);
  return { rates, gap: Math.max(...rates) - Math.min(...rates), lula: (100 * lulaWins) / n, median: rounds[n >> 1] };
}

const fmt = (m) => `${m.rates.map((r) => r.toFixed(1)).join(' / ')}  gap ${m.gap.toFixed(1)}${deal === 'polarized' ? `  N/NE side ${m.lula.toFixed(1)}%` : ''}  median ${m.median}`;

console.log(`size ${size}, armies ${armiesArg}, deal ${deal}, ${N} matches per step`);
let bonus = [...start];
const seen = new Map();
let best = null;
for (let step = 0; step < MAX_STEPS; step++) {
  const key = bonus.join(',');
  if (seen.has(key)) break;
  const m = measure(bonus, N);
  seen.set(key, m);
  console.log(`  [${key}]  ${fmt(m)}`);
  if (!best || m.gap < best.m.gap) best = { bonus: [...bonus], m };
  if (m.gap <= TARGET_GAP) break;
  const weakest = m.rates.indexOf(Math.min(...m.rates));
  const strongest = m.rates.indexOf(Math.max(...m.rates));
  if (bonus[strongest] > 0 && Math.max(...m.rates) - 100 / size > 100 / size - Math.min(...m.rates)) bonus[strongest] -= 1;
  else bonus[weakest] += 1;
  // Keep position 1 at zero: shift the whole row down if everybody has a bonus.
  const floor = Math.min(...bonus);
  bonus = bonus.map((b) => b - floor);
}
const confirm = measure(best.bonus, N * 4);
console.log(`BEST [${best.bonus.join(',')}] confirmed with ${N * 4}: ${fmt(confirm)}`);
console.log(JSON.stringify({ size, armies: armiesArg, deal, bonus: best.bonus, rates: confirm.rates, gap: confirm.gap, lula: confirm.lula, n: N * 4 }));
