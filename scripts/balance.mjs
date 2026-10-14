// Balance report: runs AI-only matches and prints win rate by starting seat,
// match length, early eliminations and opening facts.
// Usage: node scripts/balance.mjs [matches] [deal] [armies] [sizes]
//   deal:   "random" (default) or "polarized" (2 factions, Lula vs. Flávio only)
//   armies: 1 (default), 2, 3 or "mixed"
//   sizes:  comma list of faction counts, default "2,3,4"
import { createGame, territoriesOf, attackTargets } from '../src/game/engine.js';
import { aiStep } from '../src/game/ai.js';

const N = Number(process.argv[2] ?? 1000);
const deal = process.argv[3] ?? 'random';
const armiesArg = process.argv[4] ?? '1';
const armies = armiesArg === 'mixed' ? 'mixed' : Number(armiesArg);
const sizes = deal === 'polarized' ? [2] : (process.argv[5] ?? '2,3,4').split(',').map(Number);
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
const armyTotal = (g, f) => territoriesOf(g, f).reduce((s, id) => s + g.troops[id], 0);

for (const n of sizes) {
  const rounds = [];
  const seatWins = Array(n).fill(0);
  const byFaction = {};
  let early = 0;
  let seat1Early = 0;
  let shortWins = 0;
  let shortGames = 0;
  let viableOpening = 0;
  let startArmies = 0;
  let maxStack = 0;
  for (let i = 0; i < N; i++) {
    const lineup = deal === 'polarized' ? shuffle(['lula', 'flavio']) : shuffle(ALL).slice(0, n);
    let g = createGame(lineup[0], Math.random, lineup.slice(1), { spectator: true, deal, armies });
    // Seat = position in the drawn turn order (v0.7.1), not in the line-up list.
    const seats = [...g.factions];
    const counts = lineup.map((f) => territoriesOf(g, f).length);
    const short = lineup.filter((f, k) => counts[k] < Math.max(...counts));
    startArmies += armyTotal(g, lineup[0]);
    maxStack = Math.max(maxStack, ...Object.values(g.troops));
    const outRound = {};
    let steps = 0;
    let openingChecked = false;
    while (g.phase !== 'over' && steps++ < 50000) {
      if (!openingChecked && g.phase === 'attack') {
        // Opening: does the first battler have at least one favourable attack (>= 2 more armies)?
        const me = g.current;
        const ok = territoriesOf(g, me).some((from) => attackTargets(g, from).some((to) => g.troops[from] >= g.troops[to] + 2));
        if (ok) viableOpening++;
        openingChecked = true;
      }
      const before = g.eliminated.length;
      g = aiStep(g);
      if (g.eliminated.length > before) outRound[g.eliminated.at(-1)] = g.round;
    }
    rounds.push(g.round);
    seatWins[seats.indexOf(g.winner)]++;
    for (const f of lineup) {
      byFaction[f] ??= { games: 0, wins: 0 };
      byFaction[f].games++;
    }
    byFaction[g.winner].wins++;
    if (short.length) {
      shortGames += short.length;
      shortWins += short.includes(g.winner) ? 1 : 0;
    }
    if (Object.values(outRound).some((r) => r <= 3)) early++;
    if (outRound[seats[0]] <= 4) seat1Early++;
  }
  rounds.sort((a, b) => a - b);
  console.log(`\n${n} factions, ${N} matches (${deal} deal, armies ${armiesArg})`);
  console.log(`  rounds: median ${rounds[N >> 1]}, p90 ${rounds[Math.floor(N * 0.9)]}, max ${rounds.at(-1)}, >20: ${pct(rounds.filter((r) => r > 20).length, N)}`);
  console.log(`  win by turn position (fair ${(100 / n).toFixed(1)}%): ${seatWins.map((w, i) => `seat${i + 1} ${pct(w, N)}`).join(', ')}`);
  console.log(`  win by candidate: ${Object.entries(byFaction).map(([f, s]) => `${f} ${pct(s.wins, s.games)}`).join(', ')}`);
  if (shortGames) console.log(`  fewer-states participant wins: ${pct(shortWins, shortGames)} (fair ${(100 / n).toFixed(1)}%)`);
  console.log(`  start: seat-1 armies avg ${(startArmies / N).toFixed(1)}, largest single stack ${maxStack} | first battler has a favourable attack: ${pct(viableOpening, N)}`);
  console.log(`  elimination by round 3: ${pct(early, N)} | seat 1 out by round 4: ${pct(seat1Early, N)}`);
}
