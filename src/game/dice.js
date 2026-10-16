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

// The same exchange told from the viewer's side (me: the faction looking at the
// screen, or null for spectators). names: faction -> display name; theState:
// id -> name with its article ("o Amazonas", "Rondônia").
const lost = (who, n) => `${who} ${n === 0 ? 'não perdeu' : `perdeu ${n}`}`;

export function rollOutcome(roll, me, names, theState) {
  const att = roll.attacker === me ? 'Você' : roll.defender === me ? 'Atacante' : names[roll.attacker];
  const def = roll.defender === me ? 'Você' : roll.attacker === me ? 'Inimigo' : names[roll.defender];
  // "Tudo ou nada": losses of the whole fight; the dice shown are the last roll's.
  const a = roll.series ? roll.series.attackerLoss : roll.attackerLoss;
  const d = roll.series ? roll.series.defenderLoss : roll.defenderLoss;
  // Always "you" first when the viewer is in the fight.
  const pair = roll.defender === me ? [lost(def, d), lost(att, a)] : [lost(att, a), lost(def, d)];
  let conquest = null;
  if (roll.conquered) {
    if (roll.attacker === me) conquest = `🎉 Você conquistou ${theState(roll.to)}!`;
    else if (roll.defender === me) conquest = `😱 Você perdeu ${theState(roll.to)}`;
    else conquest = `🎉 ${names[roll.attacker]} conquistou ${theState(roll.to)}`;
  }
  const ties = pairResults(roll).att.includes('tie');
  const s = roll.series;
  return {
    result: pair.join(' • '),
    conquest,
    tie: ties ? 'Empate: a defesa vence' : null,
    series: s ? `Tudo ou nada: ${s.rolls} rolagens (dados da última)` : null,
  };
}
