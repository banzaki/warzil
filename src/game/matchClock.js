// Splits a match's wall time into what the player actually did with it, sampled
// once a second: "active" (their turn, page visible, input in the last minute),
// "idle" (their turn but no input for a minute), "waiting" (page visible while
// others play) and "hidden" (tab in the background). An open tab is not playtime.
export const IDLE_AFTER_MS = 60 * 1000;

export const newClock = () => ({ active: 0, idle: 0, waiting: 0, hidden: 0 });

export function tick(clock, { visible, myTurn, now, lastInputAt }, seconds = 1) {
  const bucket = !visible ? 'hidden' : !myTurn ? 'waiting' : now - lastInputAt < IDLE_AFTER_MS ? 'active' : 'idle';
  return { ...clock, [bucket]: clock[bucket] + seconds };
}
