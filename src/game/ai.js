// CPU opponent. aiStep() performs exactly one visible action, so the UI can
// animate the AI turn by calling it on a timer until the turn passes.
// Every candidate uses this same logic and the same rules: no per-candidate
// styles, no dice tricks, no hidden bonuses.
import { ADJACENCY, REGIONS, STATES, STATE_IDS } from './data.js';
import {
  attack,
  canFortify,
  controlledRegions,
  endAttack,
  endTurn,
  finishRally,
  fortify,
  movableTroops,
  occupy,
  placeTroops,
} from './engine.js';

// Loop guards only: the rules allow unlimited attacks, these just bound CPU time.
const MAX_ATTACKS_PER_TURN = 200;
const MAX_MOVES_PER_TURN = 27;

const REGION_STATES = Object.fromEntries(
  Object.keys(REGIONS).map((r) => [r, STATE_IDS.filter((id) => STATES[id].region === r)]),
);

const enemyNeighbors = (state, id) => ADJACENCY[id].filter((n) => state.owner[n] !== state.owner[id]);
const stateCount = (state, f) => STATE_IDS.filter((id) => state.owner[id] === f).length;
const armyCount = (state, f) => STATE_IDS.reduce((sum, id) => sum + (state.owner[id] === f ? state.troops[id] : 0), 0);

// Armies that could hit this state next turn: the biggest adjacent enemy stack,
// plus a share of the others (they can all attack, one after the other).
function threat(state, id) {
  const stacks = enemyNeighbors(state, id)
    .map((n) => state.troops[n] - 1)
    .filter((n) => n > 0)
    .sort((a, b) => b - a);
  return stacks.length ? stacks[0] + stacks.slice(1).reduce((s, n) => s + n * 0.5, 0) : 0;
}

// Distance (in steps) from each own state to the front line, for moving idle
// armies towards where they are useful.
function frontDistance(state, me) {
  const dist = {};
  const queue = [];
  for (const id of STATE_IDS) {
    if (state.owner[id] === me && enemyNeighbors(state, id).length) {
      dist[id] = 0;
      queue.push(id);
    }
  }
  while (queue.length) {
    const id = queue.shift();
    for (const n of ADJACENCY[id]) {
      if (state.owner[n] === me && dist[n] === undefined) {
        dist[n] = dist[id] + 1;
        queue.push(n);
      }
    }
  }
  return dist;
}

// How much taking `to` is worth for `me`: finishing a region, breaking a
// rival's region bonus, or knocking a nearly-dead rival out of the match.
function targetValue(state, to, me) {
  const region = STATES[to].region;
  const ids = REGION_STATES[region];
  const mine = ids.filter((id) => state.owner[id] === me).length;
  let value = 1;
  if (mine === ids.length - 1) value += 2 + REGIONS[region].bonus; // completes the region
  else value += (mine / ids.length) * REGIONS[region].bonus;
  const owner = state.owner[to];
  if (controlledRegions(state, owner).includes(region)) value += 1.5 + REGIONS[region].bonus * 0.5; // breaks a bonus
  const left = stateCount(state, owner);
  if (left <= 2) value += 4 - left; // elimination within reach
  // A collapsing rival (much weaker than us) is an opportunity to finish the match.
  if (armyCount(state, owner) < 0.7 * armyCount(state, me)) value += 2;
  return value;
}

// Fights the AI expects to win. Big stacks also take even-ish fights: with
// 3 dice against a single defender die or two, the attacker is favoured.
function goodOdds(attackers, defenders) {
  const dice = attackers - 1;
  return dice >= defenders + 1 || (dice >= 3 && dice >= defenders * 1.5) || (dice >= 5 && dice >= defenders);
}

function bestAttack(state) {
  const me = state.current;
  let best = null;
  for (const from of STATE_IDS) {
    if (state.owner[from] !== me || state.troops[from] < 2) continue;
    for (const to of enemyNeighbors(state, from)) {
      if (!goodOdds(state.troops[from], state.troops[to])) continue;
      const odds = (state.troops[from] - 1) / state.troops[to];
      const score = targetValue(state, to, me) * 2 + Math.min(odds, 4);
      if (!best || score > best.score) best = { from, to, score };
    }
  }
  return best;
}

// Where to put the next chunk of reinforcements: on a threatened state that
// guards a region we hold, or behind the most valuable attack.
function pickReinforcement(state) {
  const me = state.current;
  const held = controlledRegions(state, me);
  let attackHub = null;
  let defense = null;
  for (const id of STATE_IDS) {
    if (state.owner[id] !== me) continue;
    const enemies = enemyNeighbors(state, id);
    if (!enemies.length) continue;
    for (const e of enemies) {
      const score = targetValue(state, e, me) * 3 - state.troops[e] + state.troops[id] * 0.25;
      if (!attackHub || score > attackHub.score) attackHub = { id, score };
    }
    // Defend only what pays: a border state of a region we fully hold.
    if (!held.includes(STATES[id].region)) continue;
    const danger = threat(state, id) - state.troops[id] + 3;
    if (danger > 0 && (!defense || danger > defense.danger)) defense = { id, danger };
  }
  if (defense && (!attackHub || defense.danger >= 4)) {
    return { id: defense.id, amount: Math.min(state.reinforcements, Math.ceil(defense.danger)) };
  }
  return { id: attackHub?.id ?? STATE_IDS.find((id) => state.owner[id] === me), amount: state.reinforcements };
}

// Occupation: move in what the new front needs, keep what the old one needs.
function occupyAmount(state) {
  const { from, to, min, max } = state.pendingOccupy;
  const backThreat = threat(state, from);
  if (backThreat === 0) return max;
  const frontThreat = threat(state, to);
  const share = frontThreat + backThreat === 0 ? 0.5 : frontThreat / (frontThreat + backThreat);
  return Math.max(min, Math.min(max, Math.round((max + 1) * Math.max(share, 0.5))));
}

// Movement: idle armies take one step towards the front; a quiet border state
// may also feed a neighbour under heavier threat.
function pickFortify(state) {
  const me = state.current;
  const dist = frontDistance(state, me);
  let best = null;
  for (const from of STATE_IDS) {
    const amount = movableTroops(state, from);
    if (amount < 1) continue;
    const here = dist[from];
    for (const to of ADJACENCY[from]) {
      if (!canFortify(state, from, to)) continue;
      let gain = 0;
      let send = amount;
      if (here > 0 && dist[to] !== undefined && dist[to] < here) {
        gain = 10 + amount;
      } else if (here === 0 && dist[to] === 0) {
        const spare = Math.floor(state.troops[from] - 1 - threat(state, from));
        const pressure = threat(state, to) - state.troops[to];
        if (spare >= 1 && pressure > 2) {
          gain = pressure;
          send = Math.min(amount, spare);
        }
      }
      if (gain > 0 && (!best || gain > best.gain)) best = { from, to, amount: send, gain };
    }
  }
  return best;
}

export function aiStep(state, rng = Math.random) {
  switch (state.phase) {
    case 'reinforce': {
      if (state.reinforcements === 0) return finishRally(state, rng);
      const { id, amount } = pickReinforcement(state);
      return placeTroops(state, id, Math.max(1, amount));
    }
    case 'attack': {
      const attacksSoFar = state.aiAttacks ?? 0;
      const move = attacksSoFar < MAX_ATTACKS_PER_TURN ? bestAttack(state) : null;
      if (!move) return { ...endAttack(state), aiAttacks: 0 };
      return { ...attack(state, move.from, move.to, rng), aiAttacks: attacksSoFar + 1 };
    }
    case 'occupy':
      return occupy(state, occupyAmount(state));
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
