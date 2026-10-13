// UI copy and the dialogue engine. Candidate lines live in ./lines/<id>.js
// (one file per candidate, see ./lines/README.md for the editorial rules).
import { FACTIONS, REGIONS, STATES } from './data.js';
import lula from './lines/lula.js';
import flavio from './lines/flavio.js';
import cury from './lines/cury.js';
import renan from './lines/renan.js';
import caiado from './lines/caiado.js';
import news from './lines/news.js';

export const LINES = { lula, flavio, cury, renan, caiado };
export const NEWS = news;

export const DISCLAIMER =
  'Sátira fictícia. Caricaturas originais, falas inventadas. ' +
  'Não é material de campanha. Nenhum apoio a candidato ou partido.';

export const CANDIDATES = Object.fromEntries(
  Object.entries(LINES).map(([id, l]) => [id, { name: FACTIONS[id].name, ...l.card }]),
);

export const VICTORY_TITLES = { win: 'Vitória de lavada!', lose: 'Derrota nas urnas!' };

// ---------- Placeholders ----------

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const CONTRACTIONS = { de: { a: 'da', o: 'do', '': 'de' }, em: { a: 'na', o: 'no', '': 'em' } };

export function fill(text, { state, region, rival } = {}) {
  let out = text;
  if (state) {
    const { name, article } = STATES[state];
    const withArticle = article ? `${article} ${name}` : name;
    out = out
      .replaceAll('{O_state}', capitalize(withArticle))
      .replaceAll('{o_state}', withArticle)
      .replaceAll('{de_state}', `${CONTRACTIONS.de[article]} ${name}`)
      .replaceAll('{em_state}', `${CONTRACTIONS.em[article]} ${name}`)
      .replaceAll('{state}', name);
  }
  if (region) out = out.replaceAll('{region}', REGIONS[region].name);
  if (rival) out = out.replaceAll('{rival}', FACTIONS[rival].name);
  return out;
}

// ---------- Choosing lines ----------

// A second, independent number from the same event seed.
const reseed = (seed) => (seed * 7919 + 0.137) % 1;

// Keeps the chosen text per event stable across re-renders and, per list of
// lines, cycles through every line before repeating one.
export function createLinePicker() {
  const cache = new Map();
  const recentByPool = new Map();
  return function choose(key, pool, seed) {
    if (cache.has(key)) return cache.get(key);
    if (!recentByPool.has(pool)) recentByPool.set(pool, []);
    const recent = recentByPool.get(pool);
    const start = Math.floor(seed * pool.length) % pool.length;
    // First unused line from a random start; if all were used recently, the oldest one.
    let line = null;
    let oldest = null;
    for (let k = 0; k < pool.length; k++) {
      const candidate = pool[(start + k) % pool.length];
      const age = recent.indexOf(candidate);
      if (age === -1) {
        line = candidate;
        break;
      }
      if (oldest === null || age < recent.indexOf(oldest)) oldest = candidate;
    }
    line ??= oldest;
    const seenAt = recent.indexOf(line);
    if (seenAt !== -1) recent.splice(seenAt, 1);
    recent.push(line);
    if (recent.length >= pool.length) recent.shift();
    cache.set(key, line);
    return line;
  };
}

// Without a picker (tests, one-off calls) lines are picked straight from the seed.
const stateless = (key, pool, seed) => pool[Math.floor(seed * pool.length) % pool.length];

// Turns a log event into { speaker, text } for the speech bubble.
export function describeEvent(event, choose = stateless) {
  const l = LINES[event.faction];
  const key = `${event.id}-${event.type}`;
  switch (event.type) {
    case 'start':
    case 'turn':
    case 'victory':
    case 'knockout':
      return { speaker: event.faction, text: choose(key, l[event.type], event.seed) };
    case 'conquer': {
      if (event.seed < 0.2) return { speaker: 'news', text: fill(choose(key, NEWS, event.seed * 5), event) };
      const special = l.conquerSpecial[event.state];
      const pool = special && reseed(event.seed) < 0.5 ? special : l.conquer;
      return { speaker: event.faction, text: fill(choose(key, pool, event.seed), event) };
    }
    case 'region':
      return { speaker: event.faction, text: fill(choose(key, l.regionGained, event.seed), event) };
    case 'regionLost':
      return { speaker: event.faction, text: fill(choose(key, l.regionLost, event.seed), event) };
    case 'bigLoss':
      return { speaker: event.faction, text: choose(key, l.bigLoss, event.seed) };
    case 'eliminated':
      // Last words of the candidate who just left the race.
      return { speaker: event.loser, text: choose(key, LINES[event.loser].eliminated, event.seed) };
    default:
      return { speaker: 'news', text: '' };
  }
}

// What the eliminating candidate says (shown in the elimination banner).
export function eliminatorLine(event, choose = stateless) {
  return fill(choose(`${event.id}-eliminates`, LINES[event.faction].eliminates, reseed(event.seed)), { rival: event.loser });
}

// What the losing side mutters after losing a state (campaign diary).
export function loseLine(event, choose = stateless) {
  return fill(choose(`${event.id}-lose`, LINES[event.loser].lose, reseed(event.seed)), event);
}

// End-screen line for the candidate who lost the match.
export function defeatLine(faction, seed, choose = stateless) {
  return choose(`defeat-${faction}`, LINES[faction].defeat, seed);
}

export const PHASE_HELP = {
  reinforce: 'Toque nos seus estados para colocar reforços.',
  attack: 'Toque num estado seu (2+ exércitos) e depois num inimigo brilhando para rolar os dados.',
  occupy: 'Estado conquistado! Escolha quantos exércitos entram.',
  fortify: 'Toque num estado seu e depois num vizinho seu. Cada estado envia uma vez por turno; quem chega não sai de novo. Tracejado = já moveu.',
};

export const PHASE_NAMES = {
  reinforce: 'Comício',
  attack: 'Batalha',
  occupy: 'Ocupação',
  fortify: 'Movimentação',
};
