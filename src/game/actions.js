// Player actions as plain data, applied with the rules engine. The same
// function runs in the browser (solo games) and on the server (online rooms),
// so online matches follow exactly the same rules.
import {
  attack,
  blitz,
  endAttack,
  endTurn,
  finishRally,
  fortify,
  occupy,
  placeTroops,
  resetRally,
  selectTarget,
  selectTerritory,
  undoPlacement,
} from './engine.js';

// Actions that change the shared game (selection is local to each screen).
export const GAME_ACTIONS = ['place', 'undo', 'resetRally', 'finishRally', 'attack', 'blitz', 'occupy', 'endAttack', 'fortify', 'endTurn'];

const isId = (v) => typeof v === 'string' && v.length === 2;
const isCount = (v) => Number.isInteger(v) && v >= 0 && v <= 999;

// Returns the next state; an illegal or malformed action returns `state` unchanged.
export function applyAction(state, action, rng = Math.random) {
  if (!action || typeof action !== 'object') return state;
  switch (action.kind) {
    case 'place':
      return isId(action.id) && isCount(action.amount) && action.amount > 0 ? placeTroops(state, action.id, action.amount) : state;
    case 'undo':
      return undoPlacement(state);
    case 'resetRally':
      return resetRally(state);
    case 'finishRally':
      return finishRally(state, rng);
    case 'attack':
      return isId(action.from) && isId(action.to) ? attack(state, action.from, action.to, rng) : state;
    case 'blitz':
      return isId(action.from) && isId(action.to) ? blitz(state, action.from, action.to, rng) : state;
    case 'occupy':
      return isCount(action.total) ? occupy(state, action.total) : state;
    case 'endAttack':
      return endAttack(state);
    case 'fortify':
      return isId(action.from) && isId(action.to) && isCount(action.amount) && action.amount > 0
        ? fortify(state, action.from, action.to, action.amount)
        : state;
    case 'endTurn':
      return endTurn(state, rng);
    // Local-only: highlight a state / pick a target on this screen.
    case 'select':
      return selectTerritory(state, action.id ?? null);
    case 'target':
      return selectTarget(state, action.id ?? null);
    default:
      return state;
  }
}
