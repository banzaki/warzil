// Online room logic, independent of the network: the Durable Object (room-object.js)
// loads a room, calls these functions and broadcasts the result. Pure functions
// returning { room, error? } so they can be unit-tested with node:test.
//
// The server is authoritative: it holds the official game state, rolls the dice
// and only accepts actions from the player whose turn it is.
import { createGame } from '../src/game/engine.js';
import { aiStep } from '../src/game/ai.js';
import { GAME_ACTIONS, applyAction } from '../src/game/actions.js';
import { ARMY_MODES } from '../src/game/engine.js';

export const MAX_PLAYERS = 4;
export const FACTION_IDS = ['lula', 'flavio', 'cury', 'renan', 'caiado'];
// A disconnected player's turn is played by the AI after this long...
export const COVER_AFTER_MS = 60_000;
// ...and so is the turn of a connected player who stops playing.
export const IDLE_COVER_MS = 120_000;
// Rooms with no activity for this long are deleted.
export const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
// Everybody sees a countdown this long before the AI covers a player.
export const COVER_WARNING_MS = 30_000;
const NICK_MAX = 16;

const fail = (room, error) => ({ room, error });
const touch = (room, now) => ({ ...room, updatedAt: now });

export function cleanNick(nick) {
  const clean = String(nick ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, NICK_MAX);
  return clean || null;
}

export function createRoom({ code, nick, token, playerId, now }) {
  const name = cleanNick(nick);
  if (!name) return fail(null, 'nick');
  const room = {
    code,
    status: 'lobby',
    hostId: playerId,
    players: [{ id: playerId, token, nick: name, faction: null, connected: false, lastSeen: now }],
    settings: { armies: 1, aiCount: 0 },
    game: null,
    controllers: {},
    lastSeq: {},
    lastMoveAt: now,
    createdAt: now,
    updatedAt: now,
  };
  return { room };
}

export function joinRoom(room, { nick, token, playerId, now }) {
  const name = cleanNick(nick);
  if (!name) return fail(room, 'nick');
  if (room.status !== 'lobby') return fail(room, 'started');
  if (room.players.length + room.settings.aiCount >= MAX_PLAYERS) return fail(room, 'full');
  if (room.players.some((p) => p.nick.toLowerCase() === name.toLowerCase())) return fail(room, 'nick-taken');
  const players = [...room.players, { id: playerId, token, nick: name, faction: null, connected: false, lastSeen: now }];
  return { room: touch({ ...room, players }, now) };
}

export const playerByToken = (room, token) => room.players.find((p) => p.token === token) ?? null;

// Reconnecting with the same link brings a player back (also after "Sair"),
// and hands their turn back to them if the AI was covering it.
export function setConnected(room, playerId, connected, now) {
  // The socket closing right after "Sair" must not restart the cover clock.
  const update = (p) => (connected ? { ...p, connected, lastSeen: now, left: false } : { ...p, connected, lastSeen: p.left ? p.lastSeen : now });
  const players = room.players.map((p) => (p.id === playerId ? update(p) : p));
  let next = { ...room, players };
  if (connected && isCovering(room, playerId)) next = { ...next, covering: null, lastMoveAt: now };
  return { room: touch(next, now) };
}

// The host role always belongs to a person, never to an AI. It passes on when the
// host leaves, or stays disconnected long enough for their turns to be covered.
const hostGone = (room, now) => {
  const host = room.players.find((p) => p.id === room.hostId);
  return !host || host.left || (!host.connected && now - host.lastSeen >= COVER_AFTER_MS);
};

export function ensureHost(room, now) {
  if (!room || !hostGone(room, now)) return room;
  const candidates = room.players.filter((p) => p.id !== room.hostId && !p.left);
  const next = candidates.find((p) => p.connected) ?? (room.players.some((p) => p.id === room.hostId && !p.left) ? null : candidates[0]);
  return next ? touch({ ...room, hostId: next.id }, now) : room;
}

// Each candidate can be taken by one player only.
export function pickFaction(room, playerId, faction, now) {
  if (room.status !== 'lobby') return fail(room, 'started');
  if (faction !== null && !FACTION_IDS.includes(faction)) return fail(room, 'faction');
  if (faction && room.players.some((p) => p.faction === faction && p.id !== playerId)) return fail(room, 'faction-taken');
  const players = room.players.map((p) => (p.id === playerId ? { ...p, faction } : p));
  return { room: touch({ ...room, players }, now) };
}

export function setSettings(room, playerId, settings, now) {
  if (playerId !== room.hostId) return fail(room, 'host-only');
  if (room.status !== 'lobby') return fail(room, 'started');
  const armies = ARMY_MODES.includes(settings.armies) ? settings.armies : room.settings.armies;
  const maxAi = MAX_PLAYERS - room.players.length;
  const aiCount = Number.isInteger(settings.aiCount) ? Math.max(0, Math.min(maxAi, settings.aiCount)) : room.settings.aiCount;
  return { room: touch({ ...room, settings: { armies, aiCount } }, now) };
}

// Host starts once every player picked a candidate and there are 2-4 participants.
export function startGame(room, playerId, rng, now) {
  if (playerId !== room.hostId) return fail(room, 'host-only');
  if (room.status === 'playing') return fail(room, 'started');
  if (room.players.some((p) => !p.faction)) return fail(room, 'pick-first');
  const humans = room.players.map((p) => p.faction);
  const free = FACTION_IDS.filter((f) => !humans.includes(f));
  const ai = [];
  for (let i = 0; i < room.settings.aiCount && free.length; i++) ai.push(free.splice(Math.floor(rng() * free.length), 1)[0]);
  const factions = [...humans, ...ai];
  if (factions.length < 2) return fail(room, 'need-two');
  const game = createGame(factions[0], rng, factions.slice(1), { spectator: true, armies: room.settings.armies });
  const controllers = Object.fromEntries([...room.players.map((p) => [p.faction, p.id]), ...ai.map((f) => [f, 'ai'])]);
  return { room: touch({ ...room, status: 'playing', game, controllers, covering: null, lastSeq: {}, lastMoveAt: now, startedAt: now, matchNo: (room.matchNo ?? 0) + 1 }, now) };
}

// Same line-up, new deal and a new order draw. Players who left are played by the AI.
export function rematch(room, playerId, rng, now) {
  if (playerId !== room.hostId) return fail(room, 'host-only');
  if (room.status !== 'over') return fail(room, 'not-over');
  const factions = room.game.factions;
  const game = createGame(factions[0], rng, factions.slice(1), { spectator: true, armies: room.settings.armies });
  return { room: touch({ ...room, status: 'playing', game, covering: null, lastSeq: {}, lastMoveAt: now, startedAt: now, matchNo: (room.matchNo ?? 0) + 1 }, now) };
}

// Back to the lobby: players who left during the match free their seats.
export function backToLobby(room, playerId, now) {
  if (playerId !== room.hostId) return fail(room, 'host-only');
  if (room.status === 'lobby') return { room };
  const players = room.players.filter((p) => !p.left);
  const settings = { ...room.settings, aiCount: Math.min(room.settings.aiCount, MAX_PLAYERS - players.length) };
  return { room: touch({ ...room, players, settings, status: 'lobby', game: null, controllers: {}, covering: null, lastSeq: {} }, now) };
}

const finishIfOver = (room) => (room.game?.phase === 'over' ? { ...room, status: 'over' } : room);

// A player's move. `seq` must grow per player: resent or duplicated messages are rejected.
export function playerAction(room, playerId, action, seq, rng, now) {
  if (room.status !== 'playing') return fail(room, 'not-playing');
  if (!Number.isInteger(seq) || seq <= (room.lastSeq[playerId] ?? 0)) return fail(room, 'duplicate');
  if (!action || !GAME_ACTIONS.includes(action.kind)) return fail(room, 'action');
  if (room.controllers[room.game.current] !== playerId) return fail(room, 'not-your-turn');
  // While the AI covers this turn, the player first takes it back ("resume").
  if (isCovering(room, playerId)) return fail(room, 'covered');
  const game = applyAction(room.game, action, rng);
  const lastSeq = { ...room.lastSeq, [playerId]: seq };
  if (game === room.game) return fail({ ...room, lastSeq }, 'illegal');
  return { room: finishIfOver(touch({ ...room, game, lastSeq, lastMoveAt: now }, now)) };
}

// "Sair da sala". In the lobby the player (and the seat) is freed; the host role
// passes on; an empty room is closed. During or after a match the candidate stays,
// the AI covers that player's turns at once (they can come back with the same link)
// and the host role passes to another person; with nobody left, the room closes.
export function leaveRoom(room, playerId, now) {
  if (room.status !== 'lobby') {
    const players = room.players.map((p) => (p.id === playerId ? { ...p, connected: false, left: true, lastSeen: now - COVER_AFTER_MS } : p));
    if (players.every((p) => p.left)) return { room: null };
    return { room: ensureHost(touch({ ...room, players }, now), now) };
  }
  const players = room.players.filter((p) => p.id !== playerId);
  if (!players.length) return { room: null };
  const hostId = room.hostId === playerId ? players[0].id : room.hostId;
  const settings = { ...room.settings, aiCount: Math.min(room.settings.aiCount, MAX_PLAYERS - players.length) };
  return { room: touch({ ...room, players, hostId, settings }, now) };
}

// The AI is covering `playerId`'s current turn.
function isCovering(room, playerId) {
  return room.status === 'playing' && !!room.covering && room.covering === room.game?.current && room.controllers[room.covering] === playerId;
}

// When the AI starts covering the current (human) turn: null if it never will
// (an AI seat, or the cover already started).
export function coverAt(room) {
  if (room.status !== 'playing') return null;
  const faction = room.game.current;
  const ctrl = room.controllers[faction];
  if (ctrl === 'ai' || room.covering === faction) return null;
  const player = room.players.find((p) => p.id === ctrl);
  if (!player) return null;
  if (!player.connected) return player.lastSeen + COVER_AFTER_MS;
  return (room.lastMoveAt ?? room.updatedAt) + IDLE_COVER_MS;
}

// Who plays the current turn on the server: the AI, or a player it covers. Once a
// cover starts it lasts until the turn passes or the player takes it back.
export function needsServerMove(room, now) {
  if (room.status !== 'playing') return false;
  const ctrl = room.controllers[room.game.current];
  if (ctrl === 'ai' || room.covering === room.game.current) return true;
  const player = room.players.find((p) => p.id === ctrl);
  if (!player) return true;
  return now >= coverAt(room);
}

export function serverMove(room, rng, now) {
  if (!needsServerMove(room, now)) return fail(room, 'no-move');
  const faction = room.game.current;
  const covered = room.controllers[faction] !== 'ai' ? faction : null;
  const game = aiStep(room.game, rng);
  // The cover ends with the covered faction's turn.
  const covering = covered && game.current === faction && game.phase !== 'over' ? faction : null;
  return { room: finishIfOver(touch({ ...room, game, covering, lastMoveAt: now }, now)) };
}

// "Retomar": the player takes their turn back from the AI.
export function resumeControl(room, playerId, now) {
  if (!isCovering(room, playerId)) return fail(room, 'not-covered');
  return { room: touch({ ...room, covering: null, lastMoveAt: now }, now) };
}

export const isExpired = (room, now) => now - room.updatedAt >= ROOM_TTL_MS;

// What a given player receives: no tokens, plus who they are.
export function publicView(room, playerId, now = Date.now()) {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    you: playerId,
    // Last action number accepted from this player, so a reloaded page continues from it.
    yourSeq: room.lastSeq[playerId] ?? 0,
    players: room.players.map(({ id, nick, faction, connected, left }) => ({ id, nick, faction, connected, left: !!left })),
    settings: room.settings,
    controllers: room.controllers,
    matchNo: room.matchNo ?? 0,
    // Cover countdown: the faction the AI covers now, or when it will start covering
    // (server clock; `serverNow` lets clients correct for their own clock).
    covering: room.status === 'playing' ? (room.covering ?? null) : null,
    coverAt: coverAt(room),
    serverNow: now,
    game: room.game,
  };
}
