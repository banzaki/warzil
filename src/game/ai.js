// Simple opponent. aiStep() performs exactly one visible action, so the UI can
// animate the AI turn by calling it on a timer until the turn passes.
import { ADJACENCY, REGIONS, STATES, STATE_IDS } from './data.js';
import { attack, canFortify, endAttack, endTurn, fortify, movableTroops, occupy, placeTroops } from './engine.js';

// Loop guards only: the rules allow unlimited attacks, these just bound CPU time.
const MAX_ATTACKS_PER_TURN = 200;
const MAX_MOVES_PER_TURN = 27;

const enemyNeighbors = (state, id) => ADJACENCY[id].filter((n) => state.owner[n] !== state.owner[id]);

// Share of a region already held by the faction (0..1). Finishing regions pays bonuses.
function regionProgress(state, region, faction) {
  const ids = STATE_IDS.filter((id) => STATES[id].region === region);
  return ids.filter((id) => state.owner[id] === faction).length / ids.length;
}

// The rival holding the fewest states. With 3-4 factions the AI prefers to
// finish off the weakest one, which keeps multi-faction matches short.
function weakestOf(state, me) {
  let best = null;
  let bestCount = Infinity;
  for (const f of state.factions) {
    if (f === me || state.eliminated.includes(f)) continue;
    const count = STATE_IDS.filter((id) => state.owner[id] === f).length;
    if (count < bestCount) [best, bestCount] = [f, count];
  }
  return best;
}

function targetValue(state, to, faction, weakest) {
  const region = STATES[to].region;
  const finishBonus = state.factions.length > 2 && state.owner[to] === weakest ? 1.5 : 0;
  return regionProgress(state, region, faction) * REGIONS[region].bonus + finishBonus;
}

function bestAttack(state) {
  const me = state.current;
  const weakest = weakestOf(state, me);
  let best = null;
  for (const from of STATE_IDS) {
    if (state.owner[from] !== me || state.troops[from] < 3) continue;
    for (const to of enemyNeighbors(state, from)) {
      const margin = state.troops[from] - state.troops[to];
      if (margin < 2) continue;
      const score = margin + targetValue(state, to, me, weakest) * 2;
      if (!best || score > best.score) best = { from, to, score };
    }
  }
  return best;
}

function pickReinforceTarget(state) {
  const me = state.current;
  const weakest = weakestOf(state, me);
  let best = null;
  for (const id of STATE_IDS) {
    if (state.owner[id] !== me) continue;
    const enemies = enemyNeighbors(state, id);
    if (enemies.length === 0) continue;
    // Prefer staging next to weak, valuable enemy states.
    let score = -Infinity;
    for (const e of enemies) {
      score = Math.max(score, 12 - state.troops[e] + targetValue(state, e, me, weakest) * 3);
    }
    score += state.troops[id] * 0.3;
    if (!best || score > best.score) best = { id, score };
  }
  return best?.id ?? STATE_IDS.find((id) => state.owner[id] === me);
}

function pickFortify(state) {
  // Move idle armies from a safe interior state to a neighbouring front line,
  // using the same per-state limits as the player.
  for (const from of STATE_IDS) {
    const amount = movableTroops(state, from);
    if (amount < 1 || enemyNeighbors(state, from).length > 0) continue;
    const to = ADJACENCY[from].find((n) => canFortify(state, from, n) && enemyNeighbors(state, n).length > 0);
    if (to) return { from, to, amount };
  }
  return null;
}

export function aiStep(state, rng = Math.random) {
  switch (state.phase) {
    case 'reinforce': {
      const id = pickReinforceTarget(state);
      // Two placements per turn: most on the attack hub, the rest re-evaluated.
      const amount = state.reinforcements > 2 ? Math.ceil((state.reinforcements * 2) / 3) : state.reinforcements;
      return placeTroops(state, id, amount);
    }
    case 'attack': {
      const attacksSoFar = state.aiAttacks ?? 0;
      const move = attacksSoFar < MAX_ATTACKS_PER_TURN ? bestAttack(state) : null;
      if (!move) return { ...endAttack(state), aiAttacks: 0 };
      return { ...attack(state, move.from, move.to, rng), aiAttacks: attacksSoFar + 1 };
    }
    case 'occupy': {
      const { from, min, max } = state.pendingOccupy;
      const stillExposed = enemyNeighbors(state, from).length > 0;
      return occupy(state, stillExposed ? Math.max(min, Math.floor((min + max) / 2)) : max);
    }
    case 'fortify': {
      const movesSoFar = state.aiMoves ?? 0;
      const move = movesSoFar < MAX_MOVES_PER_TURN ? pickFortify(state) : null;
      if (!move) return { ...endTurn(state, rng), aiMoves: 0 };
      return { ...fortify(state, move.from, move.to, move.amount), aiMoves: movesSoFar + 1 };
    }
    default:
      return state;
  }
}
