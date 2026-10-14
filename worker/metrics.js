// Usage metrics: one counter per event and day, nothing else. No nicknames, IPs,
// tokens or payment data are stored, only "how many times did X happen today".

// Events the browser may report (solo/daily, local, connection trouble) and the
// ones the online rooms count on the server (so reconnects never double count).
export const CLIENT_EVENTS = ['solo_start', 'solo_end', 'solo_rematch', 'local_start', 'local_end', 'local_rematch', 'conn_error'];
export const SERVER_EVENTS = ['room_created', 'online_start', 'online_end', 'online_rematch'];
export const METRIC_EVENTS = [...CLIENT_EVENTS, ...SERVER_EVENTS];

const BRT_OFFSET_MS = 3 * 3600 * 1000;
// Days are counted in Brasília time (UTC-3).
export const metricDay = (now = Date.now()) => new Date(now - BRT_OFFSET_MS).toISOString().slice(0, 10);

// Rows [{ day, event, n }] -> { totals, days: { day: { event: n } } }, newest day first.
export function summarize(rows) {
  const totals = {};
  const days = {};
  for (const { day, event, n } of rows) {
    totals[event] = (totals[event] ?? 0) + n;
    (days[day] ??= {})[event] = n;
  }
  const sorted = Object.fromEntries(Object.entries(days).sort(([a], [b]) => (a < b ? 1 : -1)));
  return { totals, days: sorted };
}
