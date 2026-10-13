// Pure game rules. Every function takes a state and returns a new state,
// so the UI, the AI and the tests all drive the game the same way.
import { ADJACENCY, REGIONS, STATES, STATE_IDS, opponentOf } from './data.js';

// Armies per faction at the start, by number of factions in the match.
export const STARTING_TROOPS = { 2: 40, 3: 30, 4: 24 };
const MAX_LOG = 40;

export const isAdjacent = (a, b) => ADJACENCY[a].includes(b);

export const territoriesOf = (state, faction) =>
  STATE_IDS.filter((id) => state.owner[id] === faction);

function shuffle(list, rng) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function addLog(state, event, rng) {
  const entry = { id: state.logCounter + 1, seed: rng(), ...event };
  return { ...state, logCounter: entry.id, log: [entry, ...state.log].slice(0, MAX_LOG) };
}

export function controlledRegions(state, faction) {
  return Object.keys(REGIONS).filter((region) =>
    STATE_IDS.filter((id) => STATES[id].region === region).every((id) => state.owner[id] === faction),
  );
}

export function calcReinforcements(state, faction) {
  const count = territoriesOf(state, faction).length;
  const base = Math.max(3, Math.floor(count / 2));
  const regions = controlledRegions(state, faction);
  const bonus = regions.reduce((sum, r) => sum + REGIONS[r].bonus, 0);
  return { base, bonus, regions, total: base + bonus };
}

function beginTurn(state, faction) {
  const { total } = calcReinforcements(state, faction);
  return {
    ...state,
    current: faction,
    phase: 'reinforce',
    reinforcements: total,
    selected: null,
    target: null,
    pendingOccupy: null,
    lastRoll: null,
    movedOut: {},
    received: {},
    turn: state.turn + 1,
  };
}

// rivals: the CPU factions, in turn order after the human (default: the classic duel).
export function createGame(humanFaction, rng = Math.random, rivals = [opponentOf(humanFaction)]) {
  const factions = [humanFaction, ...rivals];
  // Deal round-robin. Duel: the AI (moving second) gets the 14th state, as in v0.2.
  // 4 factions: the last seat gets the short hand (7/7/7/6); simulations showed the
  // first seat holding 6 states was knocked out first a third of the time.
  // Re-deal until nobody starts with a whole region (and its free bonus).
  const dealOrder = factions.length === 4 ? [...factions] : [...factions].reverse();
  let order;
  const owner = {};
  do {
    order = shuffle(STATE_IDS, rng);
    order.forEach((id, i) => {
      owner[id] = dealOrder[i % dealOrder.length];
    });
  } while (factions.some((f) => controlledRegions({ owner }, f).length));

  const troops = {};
  const startingTroops = STARTING_TROOPS[factions.length];
  for (const faction of dealOrder) {
    const mine = order.filter((id) => owner[id] === faction);
    mine.forEach((id) => (troops[id] = 2));
    for (let extra = startingTroops - mine.length * 2; extra > 0; extra--) {
      troops[mine[Math.floor(rng() * mine.length)]] += 1;
    }
  }

  const state = {
    human: humanFaction,
    factions,
    eliminated: [],
    round: 1,
    owner,
    troops,
    current: humanFaction,
    phase: 'reinforce',
    reinforcements: 0,
    selected: null,
    target: null,
    pendingOccupy: null,
    lastRoll: null,
    turn: 0,
    winner: null,
    log: [],
    logCounter: 0,
  };
  return addLog(beginTurn(state, humanFaction), { type: 'start', faction: humanFaction }, rng);
}

// ---------- Reinforce ----------

export function placeTroops(state, id, amount = 1) {
  if (state.phase !== 'reinforce' || state.owner[id] !== state.current) return state;
  const n = Math.min(amount, state.reinforcements);
  if (n <= 0) return state;
  const reinforcements = state.reinforcements - n;
  return {
    ...state,
    troops: { ...state.troops, [id]: state.troops[id] + n },
    reinforcements,
    phase: reinforcements === 0 ? 'attack' : 'reinforce',
    selected: null,
    target: null,
  };
}

// ---------- Attack ----------

export function canAttack(state, from, to) {
  return (
    state.phase === 'attack' &&
    state.owner[from] === state.current &&
    state.owner[to] !== state.current &&
    state.troops[from] >= 2 &&
    isAdjacent(from, to)
  );
}

const rollDice = (count, rng) =>
  Array.from({ length: count }, () => 1 + Math.floor(rng() * 6)).sort((a, b) => b - a);

// Classic War dice: attacker rolls up to 3 dice but must leave 1 army home;
// defender rolls up to 3, limited by its armies.
export const attackerDiceCount = (armies) => Math.max(0, Math.min(3, armies - 1));
export const defenderDiceCount = (armies) => Math.min(3, armies);

// After a fight, keep attacking from the strongest state that still can.
function nextAttacker(state, candidates) {
  const able = candidates.filter((id) => attackTargets(state, id).length > 0);
  able.sort((x, y) => state.troops[y] - state.troops[x]);
  return able[0] ?? null;
}

// One dice exchange. Dice are sorted high to low and compared in pairs;
// each pair costs the loser 1 army and ties go to the defender.
export function attack(state, from, to, rng = Math.random) {
  if (!canAttack(state, from, to)) return state;
  const attackerDice = rollDice(attackerDiceCount(state.troops[from]), rng);
  const defenderDice = rollDice(defenderDiceCount(state.troops[to]), rng);
  let attackerLoss = 0;
  let defenderLoss = 0;
  for (let i = 0; i < Math.min(attackerDice.length, defenderDice.length); i++) {
    if (attackerDice[i] > defenderDice[i]) defenderLoss++;
    else attackerLoss++;
  }

  const troops = {
    ...state.troops,
    [from]: state.troops[from] - attackerLoss,
    [to]: state.troops[to] - defenderLoss,
  };
  const lastRoll = { from, to, attacker: state.current, defender: state.owner[to], attackerDice, defenderDice, attackerLoss, defenderLoss, conquered: false };
  let next = { ...state, troops, lastRoll };

  if (troops[to] > 0) {
    // Keep the same origin and target selected so the player can just roll again.
    if (canAttack(next, from, to)) return { ...next, selected: from, target: to };
    return { ...next, selected: nextAttacker(next, [from]), target: null };
  }

  // Conquest: the armies of the final roll (one per attacking die) must move in.
  // The origin keeps at least 1 army: a conquering roll never costs the attacker armies.
  const loser = state.owner[to];
  const min = attackerDice.length;
  next = {
    ...next,
    lastRoll: { ...lastRoll, conquered: true },
    owner: { ...state.owner, [to]: state.current },
    troops: { ...troops, [from]: troops[from] - min, [to]: min },
  };
  next = addLog(next, { type: 'conquer', faction: state.current, loser, state: to }, rng);

  if (territoriesOf(next, loser).length === 0) {
    next = { ...next, eliminated: [...next.eliminated, loser] };
    const survivors = next.factions.filter((f) => !next.eliminated.includes(f));
    if (survivors.length === 1) {
      return addLog(
        { ...next, phase: 'over', winner: state.current, selected: null, target: null },
        { type: 'victory', faction: state.current },
        rng,
      );
    }
    // Solo mode: losing your last state ends the match right away.
    if (loser === state.human) {
      return addLog(
        { ...next, phase: 'over', winner: state.current, selected: null, target: null },
        { type: 'knockout', faction: state.current, loser },
        rng,
      );
    }
    next = addLog(next, { type: 'eliminated', faction: state.current, loser }, rng);
  }
  const max = min + next.troops[from] - 1;
  if (max > min) {
    return { ...next, phase: 'occupy', pendingOccupy: { from, to, min, max }, selected: from, target: to };
  }
  return { ...next, selected: nextAttacker(next, [to, from]), target: null };
}

// Keep rolling until the target falls or the attacker runs out of dice.
export function blitz(state, from, to, rng = Math.random) {
  let next = state;
  while (canAttack(next, from, to)) {
    next = attack(next, from, to, rng);
  }
  return next;
}

// total: armies that end up in the conquered state, between min and max.
export function occupy(state, total) {
  if (state.phase !== 'occupy') return state;
  const { from, to, min, max } = state.pendingOccupy;
  const extra = Math.max(min, Math.min(total, max)) - min;
  const next = {
    ...state,
    troops: { ...state.troops, [from]: state.troops[from] - extra, [to]: state.troops[to] + extra },
    phase: 'attack',
    pendingOccupy: null,
    target: null,
  };
  return { ...next, selected: nextAttacker(next, [to, from]) };
}

export function endAttack(state) {
  if (state.phase !== 'attack') return state;
  return { ...state, phase: 'fortify', selected: null, target: null };
}

// ---------- Movement ----------
// Many moves per turn, but each state sends armies out only once, and armies
// received this turn stay put (no chaining an army across the map).

// Only the state's own (pre-existing) armies may leave, and 1 army must stay.
// Received armies can be the one that stays: 1 own + 5 received -> the own 1 may go.
export function movableTroops(state, id) {
  if (state.owner[id] !== state.current || state.movedOut[id]) return 0;
  const own = state.troops[id] - (state.received[id] ?? 0);
  return Math.max(0, Math.min(own, state.troops[id] - 1));
}

export function canFortify(state, from, to) {
  return (
    state.phase === 'fortify' &&
    state.owner[to] === state.current &&
    from !== to &&
    movableTroops(state, from) >= 1 &&
    isAdjacent(from, to)
  );
}

export function fortify(state, from, to, amount) {
  if (!canFortify(state, from, to)) return state;
  const n = Math.max(1, Math.min(amount, movableTroops(state, from)));
  return {
    ...state,
    troops: { ...state.troops, [from]: state.troops[from] - n, [to]: state.troops[to] + n },
    movedOut: { ...state.movedOut, [from]: true },
    received: { ...state.received, [to]: (state.received[to] ?? 0) + n },
    selected: null,
    target: null,
  };
}

// Pass the turn to the next faction still in the race; a new round starts on wrap-around.
export function endTurn(state, rng = Math.random) {
  if (state.phase === 'over') return state;
  const { factions, eliminated } = state;
  const start = factions.indexOf(state.current);
  let i = start;
  do i = (i + 1) % factions.length;
  while (eliminated.includes(factions[i]));
  const next = factions[i];
  const round = i <= start ? state.round + 1 : state.round;
  return addLog(beginTurn({ ...state, round }, next), { type: 'turn', faction: next }, rng);
}

// ---------- UI helpers ----------

export const attackTargets = (state, from) =>
  ADJACENCY[from].filter((to) => canAttack(state, from, to));

export const fortifyTargets = (state, from) =>
  ADJACENCY[from].filter((to) => canFortify(state, from, to));

export const selectTerritory = (state, selected) => ({ ...state, selected, target: null });
export const selectTarget = (state, target) => ({ ...state, target });
