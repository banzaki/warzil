// Which event the speech bubble shows when a lot happens quickly (simulations).
// A shown line stays up for `holdMs` unless something more important happens;
// when it expires, the most important event since then takes its place.
export const EVENT_PRIORITY = {
  victory: 5,
  knockout: 5,
  eliminated: 4,
  lead: 3,
  region: 3,
  lastStand: 3,
  streak: 2,
  underdog: 2,
  regionLost: 2,
  conquer: 1,
  bigLoss: 1,
  turn: 0,
  start: 0,
};

const priority = (e) => EVENT_PRIORITY[e.type] ?? -1;

export function nextHeldEvent({ shown, shownAt, log, now, holdMs }) {
  const latest = log[0];
  if (!latest) return null;
  if (!shown) return latest;
  const fresh = log.filter((e) => e.id > shown.id && priority(e) >= 0);
  if (!fresh.length) return shown;
  // Most important new event; on a tie, the most recent (log is newest first).
  const best = fresh.reduce((a, b) => (priority(b) > priority(a) ? b : a));
  if (priority(best) > priority(shown) || now - shownAt >= holdMs) return best;
  return shown;
}

// Diary rows worth listing (turn starts and the like are left out).
export const DIARY_TYPES = ['conquer', 'region', 'regionLost', 'eliminated', 'lead', 'bigLoss', 'streak', 'lastStand', 'underdog', 'victory', 'knockout'];
export const isHighlight = (e) => ['region', 'eliminated', 'lead', 'lastStand', 'victory', 'knockout'].includes(e.type);
