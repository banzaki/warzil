// Text and data for the shareable victory card (pure; the drawing lives in
// components/ShareSheet.jsx).
import { FACTIONS } from './data.js';
import { formatDailyKey } from './daily.js';

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|::1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|.*\.local)$/i;

// True for addresses that only work on the player's machine or network.
export function isLocalUrl(url) {
  try {
    return LOCAL_HOST.test(new URL(url).hostname);
  } catch {
    return true;
  }
}

// Public address printed on cards: the configured VITE_PUBLIC_URL, otherwise
// the page's own origin when it is public. Never localhost.
export function publicUrl(configured, origin) {
  for (const candidate of [configured, origin]) {
    if (candidate && !isLocalUrl(candidate)) return candidate.replace(/\/$/, '');
  }
  return null;
}

export function cardModel(game, { quote, url = null } = {}) {
  const winner = game.winner;
  return {
    winner,
    winnerName: FACTIONS[winner].name,
    playerWon: game.human ? winner === game.human : null,
    playerName: game.human ? FACTIONS[game.human].name : null,
    rounds: game.round,
    factionCount: game.factions.length,
    simulation: game.human === null,
    daily: game.daily ? formatDailyKey(game.daily) : null,
    quote,
    url,
    owner: { ...game.owner },
  };
}

export function shareText(model) {
  const who = model.simulation
    ? `${model.winnerName} venceu a simulação do WARZIL`
    : model.playerWon
      ? `Venci o WARZIL jogando de ${model.winnerName}`
      : `${model.winnerName} venceu o WARZIL (eu joguei de ${model.playerName})`;
  const lines = [
    `🏆 ${who} em ${model.rounds} rodadas, com ${model.factionCount} candidatos.`,
    model.daily ? `📅 Desafio do dia ${model.daily}` : null,
    model.quote ? `“${model.quote}”` : null,
    'Sátira fictícia, sem apoio a candidato ou partido.',
    model.url ? `Jogue: ${model.url}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}
