// Balance report: runs AI-only matches and prints win rate by starting seat,
// match length and early eliminations. Usage: node scripts/balance.mjs [matches] [deal]
//   deal: "random" (default) or "polarized" (2 factions, Lula vs. Flávio only)
import { createGame } from '../src/game/engine.js';
import { aiStep } from '../src/game/ai.js';

const N = Number(process.argv[2] ?? 1000);
const deal = process.argv[3] ?? 'random';
const ALL = ['lula', 'flavio', 'cury', 'renan', 'caiado'];
const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pct = (x, n) => `${((100 * x) / n).toFixed(1)}%`;

const sizes = deal === 'polarized' ? [2] : [2, 3, 4];
for (const n of sizes) {
  const rounds = [];
  const seatWins = Array(n).fill(0);
  const byFaction = {};
  let early = 0;
  let seat1Early = 0;
  for (let i = 0; i < N; i++) {
    const lineup = deal === 'polarized' ? shuffle(['lula', 'flavio']) : shuffle(ALL).slice(0, n);
    let g = createGame(lineup[0], Math.random, lineup.slice(1), { spectator: true, deal });
    const outRound = {};
    let steps = 0;
    while (g.phase !== 'over' && steps++ < 50000) {
      const before = g.eliminated.length;
      g = aiStep(g);
      if (g.eliminated.length > before) outRound[g.eliminated.at(-1)] = g.round;
    }
    rounds.push(g.round);
    seatWins[lineup.indexOf(g.winner)]++;
    for (const f of lineup) byFaction[f] ??= { games: 0, wins: 0 };
    for (const f of lineup) byFaction[f].games++;
    byFaction[g.winner].wins++;
    if (Object.values(outRound).some((r) => r <= 3)) early++;
    if (outRound[lineup[0]] <= 4) seat1Early++;
  }
  rounds.sort((a, b) => a - b);
  console.log(`\n${n} factions, ${N} matches (${deal} deal)`);
  console.log(`  rounds: median ${rounds[N >> 1]}, p90 ${rounds[Math.floor(N * 0.9)]}, max ${rounds.at(-1)}, >20: ${pct(rounds.filter((r) => r > 20).length, N)}`);
  console.log(`  win by seat (fair ${(100 / n).toFixed(1)}%): ${seatWins.map((w, i) => `seat${i + 1} ${pct(w, N)}`).join(', ')}`);
  console.log(`  win by candidate: ${Object.entries(byFaction).map(([f, s]) => `${f} ${pct(s.wins, s.games)}`).join(', ')}`);
  console.log(`  elimination by round 3: ${pct(early, N)} | seat 1 out by round 4: ${pct(seat1Early, N)}`);
}
