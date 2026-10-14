// Local multiplayer ("hotseat"): friends take turns on one device. It uses the
// same engine as online rooms: a game with no single "human" (so losing one
// player does not end the match), where each seat is played by a person or the AI.
import { createGame } from './engine.js';
import { MAX_FACTIONS } from './data.js';

export const MIN_LOCAL_HUMANS = 2;
export const NICK_MAX = 16;

// seats: [{ faction, human, nick }] in the order they were set up. The turn order is
// drawn by the engine, once, exactly as in solo and online matches.
export function createLocalGame(seats, rng = Math.random, { deal = 'random', armies = 1 } = {}) {
  const factions = seats.map((s) => s.faction);
  return createGame(factions[0], rng, factions.slice(1), { spectator: true, deal, armies });
}

export function validSeats(seats) {
  const factions = seats.map((s) => s.faction);
  return (
    seats.length >= 2 &&
    seats.length <= MAX_FACTIONS &&
    new Set(factions).size === factions.length &&
    seats.filter((s) => s.human).length >= MIN_LOCAL_HUMANS
  );
}

// Who controls the screen: { humans, names } for GameScreen. People without a
// nickname are shown as "Jogador N" (never as CPU).
export function localPlayers(seats) {
  const humans = seats.filter((s) => s.human).map((s) => s.faction);
  const names = {};
  seats.forEach((s, i) => {
    if (s.human) names[s.faction] = s.nick?.trim().slice(0, NICK_MAX) || `Jogador ${i + 1}`;
  });
  return { humans, names };
}

// The person looking at the board: the player whose turn it is, or, during an AI
// turn, the last person who played before it (still in the match).
export function viewerOf(game, humans) {
  const order = game.factions;
  const at = order.indexOf(game.current);
  for (let k = 0; k < order.length; k++) {
    const f = order[(at - k + order.length) % order.length];
    if (humans.includes(f) && !game.eliminated.includes(f)) return f;
  }
  return humans[0];
}

// The device must change hands: it is a person's turn and that person has not
// confirmed "Estou pronto" yet (readyFor = the last one who confirmed).
export function needsHandoff(game, humans, readyFor) {
  return humans.length >= MIN_LOCAL_HUMANS && game.phase !== 'over' && humans.includes(game.current) && game.current !== readyFor;
}
