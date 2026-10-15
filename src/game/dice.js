// Plain-language reading of a dice exchange (engine's lastRoll), for the screen.
// Dice are sorted high to low and compared in pairs; ties go to the defender.

// result per die: 'win' | 'lose' | 'tie' (lost on a tie) | 'idle' (no pair)
export function pairResults(roll) {
  const pairs = Math.min(roll.attackerDice.length, roll.defenderDice.length);
  const att = roll.attackerDice.map((v, i) => (i >= pairs ? 'idle' : v > roll.defenderDice[i] ? 'win' : v === roll.defenderDice[i] ? 'tie' : 'lose'));
  const def = roll.defenderDice.map((v, i) => (i >= pairs ? 'idle' : att[i] === 'win' ? 'lose' : 'win'));
  return { att, def };
}

const loses = (who, n) => `${who} perde ${n}`;

export function rollSummary(roll) {
  const ties = roll.attackerDice.map((v, i) => (i < roll.defenderDice.length && v === roll.defenderDice[i] ? v : null)).filter((v) => v !== null);
  return {
    dice: `ATAQUE: ${roll.attackerDice.join(', ')} | DEFESA: ${roll.defenderDice.join(', ')}`,
    result: `Resultado: ${loses('atacante', roll.attackerLoss)}, ${loses('defensor', roll.defenderLoss)}.`,
    tie: ties.length ? `Empate (${ties.map((v) => `${v} × ${v}`).join(', ')}) é da defesa.` : 'Maior contra maior; empate é da defesa.',
    series: roll.series
      ? `Tudo ou nada: ${roll.series.rolls} rolagens · atacante perdeu ${roll.series.attackerLoss}, defensor perdeu ${roll.series.defenderLoss}.`
      : null,
  };
}
