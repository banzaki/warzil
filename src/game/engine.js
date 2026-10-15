// Pure game rules. Every function takes a state and returns a new state,
// so the UI, the AI and the tests all drive the game the same way.
import { ADJACENCY, REGIONS, STATES, STATE_IDS, opponentOf } from './data.js';

// Starting armies per state: 1 (default), 2, 3, or 'mixed' (1-5 per state with
// the same total budget for everybody). No random piles on single states.
export const ARMY_MODES = [1, 2, 3, 'mixed'];
const MIXED_AVERAGE = 3;
const MIXED_MAX = 5;
// Enough for a whole match: the campaign diary can show everything that happened.
const MAX_LOG = 800;

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
  const entry = { id: state.logCounter + 1, seed: rng(), round: state.round, ...event };
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

// ---------- Round structure ----------
// Round 1 is a collective preparation: every faction places its reinforcements
// in turn order and confirms with finishRally(); nobody attacks until all are done.
// Then each faction battles and moves, then endTurn().
// From round 2 on, each faction plays a full turn: rally, battle, movement.
//
// Turn order (v0.7.1, Product Owner decision): drawn once at the start of the
// match and fixed for the whole match. `state.factions` IS that order. Eliminated
// factions are skipped. The old per-round rotation made the last faction of a
// round open the next one, i.e. battle twice in a row.

const isAlive = (state, faction) => !state.eliminated.includes(faction);

// Turn order (eliminated factions included; callers skip them). Same every round.
export const roundOrder = (state) => [...state.factions];

// Unbiased shuffle (Fisher-Yates) of the participants: the drawn turn order.
export function drawOrder(factions, rng) {
  const order = [...factions];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Next surviving faction after `faction` this round; null once the round's order is done.
const nextInOrder = (state, faction) => {
  const order = roundOrder(state);
  return order.slice(order.indexOf(faction) + 1).find((f) => isAlive(state, f)) ?? null;
};

const firstAlive = (state) => roundOrder(state).find((f) => isAlive(state, f));

// Marks of where each faction reinforced in its latest rally ({ id: { faction, n } }),
// shown on the map as "+N" until that faction's turn ends.
const withoutMarksOf = (marks = {}, faction) =>
  Object.fromEntries(Object.entries(marks).filter(([, m]) => m.faction !== faction));

function beginRally(state, faction) {
  // The opening rally also pays the opening compensation (see openingBonus).
  const bonus = state.round === 1 ? (state.openingBonus?.[faction] ?? 0) + (state.positionBonus?.[faction] ?? 0) : 0;
  return {
    ...state,
    rallyMarks: withoutMarksOf(state.rallyMarks, faction),
    current: faction,
    phase: 'reinforce',
    reinforcements: calcReinforcements(state, faction).total + bonus,
    rallyPlacements: [],
    selected: null,
    target: null,
    pendingOccupy: null,
    lastRoll: null,
    movedOut: {},
    received: {},
  };
}

function beginBattle(state, faction, rng) {
  const next = {
    ...state,
    current: faction,
    phase: 'attack',
    reinforcements: 0,
    rallyPlacements: [],
    selected: null,
    target: null,
    pendingOccupy: null,
    lastRoll: null,
    movedOut: {},
    received: {},
    turnConquests: 0,
    lastStandLogged: [],
    turn: state.turn + 1,
  };
  return addLog(next, { type: 'turn', faction }, rng);
}

// ---------- Deals ----------

// "Brasil Polarizado": a fictional duel scenario (not a picture of real voters).
// Lula leans to the North/Northeast, Flávio to the Center-South.
export const POLES = {
  lula: ['north', 'northeast'],
  flavio: ['centerWest', 'southeast', 'south'],
};
const POLE_SHARE = 0.75;
// The compact Center-South is easier to hold: with equal armies the
// North/Northeast side won only 37-39% of AI duels. It gets extra reinforcements
// in the opening rally, by army mode (2000 AI duels each, North/Northeast wins):
//   1 army: +2 -> 48.0%   2: +2 -> 48.8%   3: +3 -> 51.5%   mixed: +3 -> 50.4%
export const POLE_OPENING_BONUS = { 1: 2, 2: 2, 3: 3, mixed: 3 };
export const POLE_BONUS_SIDE = 'lula';

export const canPolarize = (factions) =>
  factions.length === 2 && Object.keys(POLES).every((f) => factions.includes(f));

const hasAttack = (owner, faction) =>
  STATE_IDS.some((id) => owner[id] === faction && ADJACENCY[id].some((n) => owner[n] !== faction));

// Every state goes to its pole's owner with POLE_SHARE chance, then counts are
// evened out to the same sizes as a random deal by moving off-pole states.
function polarizedOwner(factions, sizes, rng) {
  const owner = {};
  for (const id of STATE_IDS) {
    const home = factions.find((f) => POLES[f].includes(STATES[id].region));
    owner[id] = rng() < POLE_SHARE ? home : factions.find((f) => f !== home);
  }
  for (const f of factions) {
    const other = factions.find((x) => x !== f);
    let mine = shuffle(STATE_IDS.filter((id) => owner[id] === f), rng);
    // Give away states outside f's pole first, so the theme survives the balancing.
    mine.sort((a, b) => Number(POLES[f].includes(STATES[a].region)) - Number(POLES[f].includes(STATES[b].region)));
    while (mine.length > sizes[f]) owner[mine.shift()] = other;
  }
  return owner;
}

function startingArmies(owner, factions, mode, rng) {
  const troops = {};
  const counts = Object.fromEntries(factions.map((f) => [f, STATE_IDS.filter((id) => owner[id] === f).length]));
  if (mode !== 'mixed') {
    for (const id of STATE_IDS) troops[id] = mode;
    return troops;
  }
  // Same budget for everybody, sized on the largest holding; a smaller holding
  // just gets denser stacks. Every state keeps 1-5 armies.
  const budget = MIXED_AVERAGE * Math.max(...Object.values(counts));
  for (const f of factions) {
    const mine = STATE_IDS.filter((id) => owner[id] === f);
    mine.forEach((id) => (troops[id] = 1));
    for (let extra = budget - mine.length; extra > 0; extra--) {
      const open = mine.filter((id) => troops[id] < MIXED_MAX);
      troops[open[Math.floor(rng() * open.length)]] += 1;
    }
  }
  return troops;
}

// Opening compensation: 27 states never split evenly, so whoever starts with
// less (armies on the map + first reinforcements) gets the difference in the
// opening rally. After it, everybody has the same total. Same rule for all.
function openingBonus(owner, troops, factions) {
  const totals = Object.fromEntries(
    factions.map((f) => {
      const mine = STATE_IDS.filter((id) => owner[id] === f);
      const armies = mine.reduce((sum, id) => sum + troops[id], 0);
      return [f, armies + calcReinforcements({ owner }, f).total];
    }),
  );
  const top = Math.max(...Object.values(totals));
  return Object.fromEntries(factions.map((f) => [f, top - totals[f]]));
}

// Turn-position compensation (v0.7.1). The order is drawn once and fixed, and
// whoever battles first after the collective opening rally has an edge (AI duels:
// 1st position won ~76% with no compensation). Each later position gets a fixed
// number of extra reinforcements in the opening rally only, shown to everybody.
// Index = position in the drawn order; key = match size, then army mode.
// Calibrated with scripts/calibrate-order.mjs and confirmed with 6000-8000 AI
// matches each; win rate by position (%), target gap between positions <= 5:
//   2: 1 army 49.6/50.4 · 2: 49.9/50.1 · 3: 50.2/49.8 · mixed 50.3/49.7
//   3: 1 army 35.7/32.1/32.2 · 2: 35.1/33.3/31.5 · 3: 32.7/33.3/34.0 · mixed 33.3/34.1/32.6
//   4: 1 army 24.1/26.0/25.7/24.2 · 2: 23.1/24.5/26.6/25.9 · 3: 26.3/25.0/24.0/24.7
//      mixed 25.6/24.7/24.0/25.8 (no compensation needed)
// Without it (fixed order, 1 army): 75.8/24.2 · 46.7/28.1/25.2 · 31.1/25.9/22.9/20.1.
export const POSITION_BONUS = {
  2: { 1: [0, 5], 2: [0, 5], 3: [0, 4], mixed: [0, 4] },
  3: { 1: [0, 1, 2], 2: [0, 1, 2], 3: [0, 1, 2], mixed: [0, 1, 1] },
  4: { 1: [0, 1, 2, 2], 2: [0, 1, 2, 3], 3: [0, 0, 0, 2], mixed: [0, 0, 0, 0] },
};
// The polarized duel has its own row (its pole bonus already shifts the balance).
// 12000 matches (1 army, mixed) / 6000 (2, 3 armies); North/Northeast side ~49-52%:
//   1 army 52.0/48.0 · 2: 50.2/49.8 · 3: 50.7/49.3 · mixed 50.9/49.1
export const POLARIZED_POSITION_BONUS = { 1: [0, 4], 2: [0, 5], 3: [0, 4], mixed: [0, 4] };

function positionBonusOf(factions, mode, polarized, override) {
  const table = override ?? (polarized ? POLARIZED_POSITION_BONUS[mode] : POSITION_BONUS[factions.length]?.[mode]) ?? [];
  return Object.fromEntries(factions.map((f, i) => [f, table[i] ?? 0]));
}

function withPoleBonus(bonus, polarized, mode) {
  if (!polarized) return bonus;
  return { ...bonus, [POLE_BONUS_SIDE]: bonus[POLE_BONUS_SIDE] + POLE_OPENING_BONUS[mode] };
}

// rivals: the CPU factions, in turn order after the human (default: the classic duel).
// spectator: every faction is CPU-controlled (AI-vs-AI simulation); there is no human.
// deal: 'random' (default) or 'polarized' (Lula vs. Flávio duels only; otherwise random).
// armies: starting armies per state, one of ARMY_MODES (default 1).
// fixedOrder: keep [human, ...rivals] as the turn order instead of drawing it (tests).
// positionBonus: replaces the POSITION_BONUS row (calibration scripts only).
export function createGame(
  humanFaction,
  rng = Math.random,
  rivals = [opponentOf(humanFaction)],
  { spectator = false, deal = 'random', armies = 1, fixedOrder = false, positionBonus } = {},
) {
  // The turn order is drawn first, independently of who the player chose.
  const factions = fixedOrder ? [humanFaction, ...rivals] : drawOrder([humanFaction, ...rivals], rng);
  // Deal round-robin. Duel: the AI (moving second) gets the 14th state, as in v0.2.
  // 4 factions: the last seat gets the short hand (7/7/7/6); simulations showed the
  // first seat holding 6 states was knocked out first a third of the time.
  // Re-deal until nobody starts with a whole region (and its free bonus).
  const dealOrder = factions.length === 4 ? [...factions] : [...factions].reverse();
  const sizes = Object.fromEntries(factions.map((f) => [f, 0]));
  STATE_IDS.forEach((_, i) => sizes[dealOrder[i % dealOrder.length]]++);
  const polarized = deal === 'polarized' && canPolarize(factions);
  let order;
  let owner = {};
  do {
    order = shuffle(STATE_IDS, rng);
    if (polarized) {
      owner = polarizedOwner(factions, sizes, rng);
    } else {
      order.forEach((id, i) => {
        owner[id] = dealOrder[i % dealOrder.length];
      });
    }
  } while (factions.some((f) => controlledRegions({ owner }, f).length || !hasAttack(owner, f)));

  const armyMode = ARMY_MODES.includes(armies) ? armies : 1;
  const troops = startingArmies(owner, factions, armyMode, rng);

  const state = {
    deal: polarized ? 'polarized' : 'random',
    armies: armyMode,
    openingBonus: withPoleBonus(openingBonus(owner, troops, factions), polarized, armyMode),
    // Part of the opening rally paid for the turn position (shown separately).
    positionBonus: positionBonusOf(factions, armyMode, polarized, positionBonus),
    human: spectator ? null : humanFaction,
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
  return addLog(beginRally(state, firstAlive(state)), { type: 'start', faction: humanFaction }, rng);
}

// ---------- Reinforce ----------

export function placeTroops(state, id, amount = 1) {
  if (state.phase !== 'reinforce' || state.owner[id] !== state.current) return state;
  const n = Math.min(amount, state.reinforcements);
  if (n <= 0) return state;
  const mark = state.rallyMarks?.[id];
  return {
    ...state,
    troops: { ...state.troops, [id]: state.troops[id] + n },
    reinforcements: state.reinforcements - n,
    rallyPlacements: [...state.rallyPlacements, { id, n }],
    rallyMarks: { ...state.rallyMarks, [id]: { faction: state.current, n: (mark?.faction === state.current ? mark.n : 0) + n } },
    selected: null,
    target: null,
  };
}

// Take back the last placement of this rally (before it is confirmed).
export function undoPlacement(state) {
  if (state.phase !== 'reinforce' || state.rallyPlacements.length === 0) return state;
  const { id, n } = state.rallyPlacements.at(-1);
  const marks = { ...state.rallyMarks };
  if (marks[id].n > n) marks[id] = { ...marks[id], n: marks[id].n - n };
  else delete marks[id];
  return {
    ...state,
    rallyMarks: marks,
    troops: { ...state.troops, [id]: state.troops[id] - n },
    reinforcements: state.reinforcements + n,
    rallyPlacements: state.rallyPlacements.slice(0, -1),
  };
}

// Take back every placement of this rally.
export function resetRally(state) {
  let next = state;
  while (next.phase === 'reinforce' && next.rallyPlacements.length) next = undoPlacement(next);
  return next;
}

// Confirm the rally once every reinforcement is placed. The next faction rallies;
// after the last one, the battle stage starts with the first surviving faction.
export function finishRally(state, rng = Math.random) {
  if (state.phase !== 'reinforce' || state.reinforcements > 0) return state;
  // From round 2 on, the same faction goes straight on to its battle.
  if (state.round > 1) return beginBattle(state, state.current, rng);
  const next = nextInOrder(state, state.current);
  return next ? beginRally(state, next) : beginBattle(state, firstAlive(state), rng);
}

// Faction with strictly the most states, or null on a tie.
function leaderByStates(state) {
  const counts = state.factions.map((f) => [f, territoriesOf(state, f).length]).sort((a, b) => b[1] - a[1]);
  return counts[0][1] > counts[1][1] ? counts[0][0] : null;
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
  // id: increases with every roll, so the UI can replay its feedback animations.
  const rollCount = (state.rollCount ?? 0) + 1;
  const lastRoll = { id: rollCount, from, to, attacker: state.current, defender: state.owner[to], attackerDice, defenderDice, attackerLoss, defenderLoss, conquered: false };
  let next = { ...state, troops, lastRoll, rollCount };

  if (troops[to] > 0) {
    // A full 3-army wipe-out is worth a reaction line.
    if (attackerLoss === 3) next = addLog(next, { type: 'bigLoss', faction: state.current, state: from }, rng);
    // A rival holding its very last state survives the roll: once per battle turn.
    const defender = state.owner[to];
    const logged = next.lastStandLogged ?? [];
    if (defenderLoss === 0 && territoriesOf(state, defender).length === 1 && !logged.includes(defender)) {
      next = addLog({ ...next, lastStandLogged: [...logged, defender] }, { type: 'lastStand', faction: defender, by: state.current, state: to }, rng);
    }
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

  // Comeback from the brink (3 states or fewer before this conquest), and streaks.
  if (territoriesOf(state, state.current).length <= 3 && state.round >= 2) {
    next = addLog(next, { type: 'underdog', faction: state.current, state: to }, rng);
  }
  const streak = (state.turnConquests ?? 0) + 1;
  next = { ...next, turnConquests: streak };
  if (streak === 3 || streak === 6) next = addLog(next, { type: 'streak', faction: state.current, count: streak }, rng);

  // Whole regions changing hands get their own lines and banner.
  for (const region of controlledRegions(state, loser)) {
    if (!controlledRegions(next, loser).includes(region)) {
      next = addLog(next, { type: 'regionLost', faction: loser, by: state.current, region }, rng);
    }
  }
  const before = controlledRegions(state, state.current);
  for (const region of controlledRegions(next, state.current)) {
    if (!before.includes(region)) next = addLog(next, { type: 'region', faction: state.current, region }, rng);
  }

  // Lead change ("virada"): the attacker now holds strictly more states than anyone.
  const leaderBefore = leaderByStates(state);
  const leaderAfter = leaderByStates(next);
  if (state.round >= 2 && leaderAfter === state.current && leaderBefore && leaderBefore !== state.current) {
    next = addLog(next, { type: 'lead', faction: state.current, previous: leaderBefore }, rng);
  }

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
// lastRoll.series sums up every exchange, so the screen can show the whole fight.
export function blitz(state, from, to, rng = Math.random) {
  let next = state;
  const series = { rolls: 0, attackerLoss: 0, defenderLoss: 0 };
  while (canAttack(next, from, to)) {
    next = attack(next, from, to, rng);
    series.rolls++;
    series.attackerLoss += next.lastRoll.attackerLoss;
    series.defenderLoss += next.lastRoll.defenderLoss;
  }
  return series.rolls > 1 ? { ...next, lastRoll: { ...next.lastRoll, series } } : next;
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
// Each army moves at most once per movement phase. A state may send armies to
// several neighbours, in several transfers, as long as they are armies it had
// before anything arrived this phase: armies received this phase stay put (no
// chaining an army across the map), and 1 army always stays home.
// Moving in after a conquest belongs to the battle and is not counted here.
// movedOut[id]: armies sent from id this phase (older saved games: true = sent).
// received[id]: armies that arrived in id this phase.

// Received armies can be the one that stays: 1 own + 5 received -> the own 1 may go.
export function movableTroops(state, id) {
  if (state.owner[id] !== state.current) return 0;
  const own = state.troops[id] - (state.received?.[id] ?? 0);
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

// amount must be 1..movableTroops(from); anything else is refused (no clamping),
// so a hand-made command can never move more than the rules allow.
export function fortify(state, from, to, amount) {
  if (!canFortify(state, from, to) || !Number.isInteger(amount) || amount < 1 || amount > movableTroops(state, from)) return state;
  const next = {
    ...state,
    troops: { ...state.troops, [from]: state.troops[from] - amount, [to]: state.troops[to] + amount },
    movedOut: { ...state.movedOut, [from]: (Number(state.movedOut?.[from]) || 0) + amount },
    received: { ...state.received, [to]: (state.received?.[to] ?? 0) + amount },
    target: null,
  };
  // Keep the origin selected while it still has armies to send elsewhere.
  return { ...next, selected: movableTroops(next, from) > 0 ? from : null };
}

// End this faction's battle turn. The next surviving faction battles; after the
// last one, a new round starts with everybody's rally.
export function endTurn(state, rng = Math.random) {
  if (state.phase === 'over' || state.phase === 'reinforce') return state;
  state = { ...state, rallyMarks: withoutMarksOf(state.rallyMarks, state.current) };
  const next = nextInOrder(state, state.current);
  // Round 1: everybody already rallied, so the next faction goes to battle.
  // Later rounds: the next faction starts its full turn with a rally.
  if (next) return state.round === 1 ? beginBattle(state, next, rng) : beginRally(state, next);
  const nextRound = { ...state, round: state.round + 1 };
  return beginRally(nextRound, firstAlive(nextRound));
}

// ---------- UI helpers ----------

export const attackTargets = (state, from) =>
  ADJACENCY[from].filter((to) => canAttack(state, from, to));

export const fortifyTargets = (state, from) =>
  ADJACENCY[from].filter((to) => canFortify(state, from, to));

export const selectTerritory = (state, selected) => ({ ...state, selected, target: null });
export const selectTarget = (state, target) => ({ ...state, target });
