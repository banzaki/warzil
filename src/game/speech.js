// Candidates' lines on screen: one at a time, long enough to read, without
// slowing the match. New events wait in a short queue; when the match runs
// ahead of the reader, ordinary lines are dropped (the diary keeps them all)
// and important ones never are.

// Higher = more important. Events not listed never speak.
export const PRIORITY = {
  victory: 3,
  knockout: 3,
  eliminated: 3,
  region: 3,
  lead: 3,
  regionLost: 2,
  streak: 2,
  lastStand: 2,
  underdog: 2,
  conquer: 1,
  bigLoss: 1,
  turn: 0,
  start: 0,
};
const KEEP = 3; // lines this important are never dropped
export const MAX_WAITING = 2;
export const MIN_MS = 2200;
export const MAX_MS = 5200;

// About 3.3 words a second, plus a moment to notice the line.
export function readMs(text) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(MIN_MS, Math.min(MAX_MS, 900 + 300 * words));
}

// Adds events (oldest first) to the waiting queue and trims it to MAX_WAITING,
// dropping the least important, oldest first.
export function enqueue(queue, events) {
  const q = [...queue, ...events.filter((e) => e && PRIORITY[e.type] !== undefined)];
  while (q.length > MAX_WAITING) {
    const lowest = Math.min(...q.map((e) => PRIORITY[e.type]));
    if (lowest >= KEEP) break;
    q.splice(
      q.findIndex((e) => PRIORITY[e.type] === lowest),
      1,
    );
  }
  return q;
}

// The next line to show: the most important waiting, oldest first.
export function takeNext(queue) {
  if (!queue.length) return [null, queue];
  const top = Math.max(...queue.map((e) => PRIORITY[e.type]));
  const i = queue.findIndex((e) => PRIORITY[e.type] === top);
  return [queue[i], [...queue.slice(0, i), ...queue.slice(i + 1)]];
}
