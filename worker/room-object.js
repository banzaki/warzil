// One Durable Object per room: holds the official state, talks to the players
// over WebSockets (hibernation API) and plays AI turns on alarms.
import { DurableObject } from 'cloudflare:workers';
import {
  COVER_AFTER_MS,
  IDLE_COVER_MS,
  leaveRoom,
  ROOM_TTL_MS,
  backToLobby,
  createRoom,
  isExpired,
  joinRoom,
  needsServerMove,
  pickFaction,
  playerAction,
  playerByToken,
  publicView,
  rematch,
  serverMove,
  setConnected,
  setSettings,
  startGame,
} from './room.js';
import { aiDelay } from '../src/game/pace.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// Dice and deals come from the server's cryptographic RNG.
const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const newId = () => crypto.randomUUID().slice(0, 8);

const MAX_MESSAGE_BYTES = 4096;
const MAX_MESSAGES_PER_SECOND = 30;

export class RoomObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = undefined;
    this.rate = new Map();
  }

  async load() {
    if (this.room === undefined) this.room = (await this.ctx.storage.get('room')) ?? null;
    return this.room;
  }

  async save(room) {
    this.room = room;
    await this.ctx.storage.put('room', room);
  }

  broadcast(room) {
    for (const ws of this.ctx.getWebSockets()) {
      const [playerId] = this.ctx.getTags(ws);
      try {
        ws.send(JSON.stringify({ type: 'state', room: publicView(room, playerId) }));
      } catch {
        // Socket already gone; webSocketClose will clean up.
      }
    }
  }

  // Next alarm: an AI step, covering a disconnected player, or cleanup.
  async schedule(room) {
    const now = Date.now();
    let at = room.updatedAt + ROOM_TTL_MS;
    if (room.status === 'playing') {
      if (needsServerMove(room, now)) {
        at = now + aiDelay(room.game, room.aiSeenLogId ?? 0, 'fast');
      } else {
        const ctrl = room.controllers[room.game.current];
        const player = room.players.find((p) => p.id === ctrl);
        if (player && !player.connected) at = Math.min(at, player.lastSeen + COVER_AFTER_MS + 50);
        else at = Math.min(at, (room.lastMoveAt ?? now) + IDLE_COVER_MS + 50);
      }
    }
    await this.ctx.storage.setAlarm(at);
  }

  async commit(room) {
    await this.save(room);
    this.broadcast(room);
    await this.schedule(room);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const now = Date.now();

    if (url.pathname === '/create') {
      if (await this.load()) return json({ error: 'exists' }, 409);
      const { code, nick } = await request.json();
      const token = crypto.randomUUID();
      const playerId = newId();
      const { room, error } = createRoom({ code, nick, token, playerId, now });
      if (error) return json({ error }, 400);
      await this.save(room);
      await this.schedule(room);
      return json({ code, token, playerId });
    }

    const room = await this.load();
    if (!room) return json({ error: 'no-room' }, 404);

    if (url.pathname === '/join') {
      const { nick } = await request.json().catch(() => ({}));
      const token = crypto.randomUUID();
      const playerId = newId();
      const res = joinRoom(room, { nick, token, playerId, now });
      if (res.error) return json({ error: res.error }, 400);
      await this.commit(res.room);
      return json({ code: room.code, token, playerId });
    }

    // WebSocket: the temporary token (never the nickname) identifies the player.
    if (request.headers.get('Upgrade') === 'websocket') {
      const player = playerByToken(room, url.searchParams.get('token'));
      if (!player) return json({ error: 'token' }, 403);
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server, [player.id]);
      await this.commit(setConnected(room, player.id, true, now).room);
      return new Response(null, { status: 101, webSocket: client });
    }

    return json({ error: 'not-found' }, 404);
  }

  limited(playerId) {
    const now = Date.now();
    const slot = this.rate.get(playerId);
    if (!slot || now - slot.start >= 1000) {
      this.rate.set(playerId, { start: now, count: 1 });
      return false;
    }
    slot.count += 1;
    return slot.count > MAX_MESSAGES_PER_SECOND;
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_BYTES) return;
    const [playerId] = this.ctx.getTags(ws);
    if (this.limited(playerId)) return;
    let msg;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }
    const room = await this.load();
    if (!room) return;
    const now = Date.now();
    let res;
    switch (msg.type) {
      case 'pick':
        res = pickFaction(room, playerId, msg.faction ?? null, now);
        break;
      case 'settings':
        res = setSettings(room, playerId, msg.settings ?? {}, now);
        break;
      case 'start':
        res = startGame(room, playerId, rng, now);
        break;
      case 'action':
        res = playerAction(room, playerId, msg.action, msg.seq, rng, now);
        break;
      case 'rematch':
        res = rematch(room, playerId, rng, now);
        break;
      case 'lobby':
        res = backToLobby(room, playerId, now);
        break;
      case 'leave': {
        res = leaveRoom(room, playerId, now);
        ws.close(1000, 'Saiu da sala');
        if (res.room === null) {
          for (const other of this.ctx.getWebSockets()) other.close(1000, 'Sala encerrada');
          await this.ctx.storage.deleteAll();
          this.room = null;
          return;
        }
        break;
      }
      default:
        return;
    }
    if (res.error) {
      ws.send(JSON.stringify({ type: 'error', error: res.error, seq: msg.seq ?? null }));
      // Even a rejected action may advance the duplicate guard; keep it.
      if (res.room !== room) await this.save(res.room);
      return;
    }
    await this.commit(res.room);
  }

  async webSocketClose(ws) {
    const [playerId] = this.ctx.getTags(ws);
    const stillOpen = this.ctx.getWebSockets(playerId).some((s) => s !== ws && s.readyState === WebSocket.OPEN);
    const room = await this.load();
    if (!room || stillOpen) return;
    await this.commit(setConnected(room, playerId, false, Date.now()).room);
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }

  async alarm() {
    const room = await this.load();
    if (!room) return;
    const now = Date.now();
    if (isExpired(room, now)) {
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'Sala encerrada por inatividade');
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    if (needsServerMove(room, now)) {
      const { room: next } = serverMove(room, rng, now);
      await this.commit({ ...next, aiSeenLogId: room.game.log[0]?.id ?? 0 });
      return;
    }
    await this.schedule(room);
  }
}

// Rate limit for room creation, one object per client IP.
const WINDOW_MS = 10 * 60 * 1000;
// Generous on purpose: mobile carriers put many people behind one IP.
const MAX_ROOMS_PER_WINDOW = 30;

export class Limiter extends DurableObject {
  async fetch() {
    const now = Date.now();
    const hits = ((await this.ctx.storage.get('hits')) ?? []).filter((t) => now - t < WINDOW_MS);
    const allowed = hits.length < MAX_ROOMS_PER_WINDOW;
    if (allowed) hits.push(now);
    await this.ctx.storage.put('hits', hits);
    await this.ctx.storage.setAlarm(now + WINDOW_MS);
    return json({ allowed });
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
