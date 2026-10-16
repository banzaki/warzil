// Battle history kept by the screen: every dice exchange it saw (the engine's
// lastRoll, i.e. the official result; online, the server's), newest first.
// "Tudo ou nada" arrives as one entry with the last roll's dice and the totals.
// Nothing is sent anywhere; long matches keep the latest MAX_BATTLES.
export const MAX_BATTLES = 100;

export function recordBattle(list, roll, round) {
  if (!roll || list.some((b) => b.id === roll.id)) return list;
  const { id, attacker, defender, from, to, attackerDice, defenderDice, attackerLoss, defenderLoss, conquered } = roll;
  const entry = { id, round, attacker, defender, from, to, attackerDice, defenderDice, attackerLoss, defenderLoss, conquered, series: roll.series ?? null };
  return [entry, ...list].slice(0, MAX_BATTLES);
}
