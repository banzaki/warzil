// How long the UI waits before the AI's next step. Time follows what just
// happened: a plain roll is quick, a conquest gets a beat, an elimination a
// longer one. Settings scale everything; no pause blocks the player.

// Delays at "Normal" (ms). "Muito rápida" (x0.32) matches the v0.5 Normal.
export const BASE_DELAY = { reinforce: 1500, attack: 1100, occupy: 900, fortify: 900 };

// Extra time after an event, so the player can follow the story.
export const EVENT_EXTRA = {
  conquer: 900,
  bigLoss: 600,
  lead: 1200,
  streak: 900,
  underdog: 900,
  lastStand: 1200,
  region: 1800,
  regionLost: 1800,
  eliminated: 2600,
};

export const SPEED_FACTOR = { normal: 1, fast: 0.55, veryFast: 0.32 };

// With more CPU rivals the wait between human turns grows, so steps get a bit faster.
const RIVALS_FACTOR = { 2: 1, 3: 0.85, 4: 0.75 };

// lastSeenId: id of the newest log entry already "paid for" by a previous delay.
export function aiDelay(game, lastSeenId, speed = 'normal') {
  const latest = game.log[0];
  const extra = latest && latest.id > lastSeenId ? (EVENT_EXTRA[latest.type] ?? 0) : 0;
  const base = BASE_DELAY[game.phase] ?? 900;
  return Math.round((base + extra) * (SPEED_FACTOR[speed] ?? 1) * (RIVALS_FACTOR[game.factions.length] ?? 1));
}
