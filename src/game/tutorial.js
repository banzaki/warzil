// First-match tips: four one-line hints, one at a time, each shown on top of the
// action panel when its moment comes up in the player's own turn. Nothing pauses:
// the match (and an online room) goes on while the tip is on screen.
// Kept only in this browser; "Como jogar" can turn them back on.
const KEY = 'warzil-tutorial';

export const TIP_ORDER = ['rally', 'attack', 'dice', 'move'];

// One short instruction each; the screen also highlights what the tip is about.
export const TIPS = {
  rally: 'Coloque reforços nos seus estados. Priorize fronteiras.',
  attack: 'Escolha um estado seu e toque em um inimigo vizinho.',
  dice: 'Maior dado vence. Empate favorece a defesa.',
  move: 'Transfira tropas para estados aliados. Cada exército se move uma vez.',
};

// The tip for this moment, or null. me: the faction looking at the screen.
export function tipFor(game, me, seen) {
  if (!me || game.current !== me) return null;
  const has = (id) => seen.includes(id);
  if (game.phase === 'reinforce') return has('rally') ? null : 'rally';
  if (game.phase === 'attack' || game.phase === 'occupy') {
    if (game.lastRoll?.attacker === me && !has('dice')) return 'dice';
    return game.phase === 'attack' && !has('attack') ? 'attack' : null;
  }
  if (game.phase === 'fortify') return has('move') ? null : 'move';
  return null;
}

export function loadTutorial() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && Array.isArray(saved.seen)) return { seen: saved.seen.filter((id) => TIP_ORDER.includes(id)), off: saved.off === true };
  } catch {
    // Private mode or bad data: start fresh.
  }
  return { seen: [], off: false };
}

export function saveTutorial(t) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // Without storage the tips simply show again next time.
  }
  return t;
}

export const tutorialDone = (t) => t.off || TIP_ORDER.every((id) => t.seen.includes(id));
export const markSeen = (t, id) => (t.seen.includes(id) ? t : { ...t, seen: [...t.seen, id] });
export const resetTutorial = () => saveTutorial({ seen: [], off: false });
