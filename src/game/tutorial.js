// First-match tips: four short hints, one at a time, each shown next to the real
// controls when its moment comes up in the player's own turn. Nothing pauses:
// the match (and an online room) goes on while the tip is on screen.
// Kept only in this browser; "Como jogar" can turn them back on.
const KEY = 'warzil-tutorial';

export const TIP_ORDER = ['rally', 'attack', 'dice', 'move'];

export const TIPS = {
  rally: '🎯 Objetivo: tomar todos os estados dos rivais. Agora é o Comício: toque nos seus estados para colocar reforços, de preferência nos que fazem fronteira com inimigos.',
  attack: '⚔️ Batalha: toque num estado seu com 2 ou mais exércitos e depois num inimigo vizinho que brilhar. Dá para atacar quantas vezes quiser.',
  dice: '🎲 Quem decide são os dados: maior contra maior, e cada dado perdido custa 1 exército. Empate é da defesa. O ataque usa até 3 dados e sempre deixa 1 em casa.',
  move: '🚚 Movimentação: passe tropas para estados seus vizinhos, para quantos quiser. Cada exército se move uma vez; quem chegou fica. Depois, “Encerrar turno”.',
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
