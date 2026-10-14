// One Durable Object per room: holds the official state, talks to the players
// over WebSockets (hibernation API) and plays AI turns on alarms.
import { DurableObject } from 'cloudflare:workers';
import { countEvent } from './metrics-object.js';
import { roomEvents, sendEvents } from './analytics.js';
import {
  COVER_AFTER_MS,
  coverAt,
  ensureHost,
  leaveRoom,
  resumeControl,
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
// Length of the order-draw animation on clients (4 cards).
const DRAW_PAUSE_MS = 4000;
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
    const before = this.room ?? null;
    // Each new match gets a random id (analytics; never the room code).
    if (room && (room.matchNo ?? 0) > (before?.matchNo ?? 0)) room = { ...room, matchRef: crypto.randomUUID() };
    this.room = room;
    await this.ctx.storage.put('room', room);
    // Usage counters, from state changes only (reconnects and reloads never count).
    if (before && room) {
      if ((room.matchNo ?? 0) > (before.matchNo ?? 0)) this.ctx.waitUntil(countEvent(this.env, before.status === 'over' ? 'online_rematch' : 'online_start'));
      if (before.status !== 'over' && room.status === 'over') this.ctx.waitUntil(countEvent(this.env, 'online_end'));
    }
    const events = roomEvents(before, room, Date.now());
    if (events.length) this.ctx.waitUntil(sendEvents(this.env, events));
    return room;
  }

  broadcast(room) {
    for (const ws of this.ctx.getWebSockets()) {
      const [playerId] = this.ctx.getTags(ws);
      try {
        ws.send(JSON.stringify({ type: 'state', room: publicView(room, playerId, Date.now()) }));
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
        // Let everybody watch the order draw before the AI's first move.
        if (room.game.turn === 0 && room.startedAt) at = Math.max(at, room.startedAt + DRAW_PAUSE_MS);
      } else {
        const cover = coverAt(room);
        if (cover) at = Math.min(at, cover + 50);
      }
    }
    // A disconnected host is replaced once their absence counts as gone.
    const host = room.players.find((p) => p.id === room.hostId);
    if (host && !host.connected && !host.left && room.players.some((p) => p.id !== host.id && p.connected)) {
      at = Math.min(at, Math.max(now + 50, host.lastSeen + COVER_AFTER_MS + 50));
    }
    await this.ctx.storage.setAlarm(at);
  }

  async commit(next) {
    const room = await this.save(next);
    this.broadcast(room);
    await this.schedule(room);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const now = Date.now();

    if (url.pathname === '/create') {
      if (await this.load()) return json({ error: 'exists' }, 409);
      const { code, nick, aid } = await request.json();
      const token = crypto.randomUUID();
      const playerId = newId();
      const { room, error } = createRoom({ code, nick, token, playerId, now, aid });
      if (error) return json({ error }, 400);
      await this.save(room);
      await this.schedule(room);
      this.ctx.waitUntil(countEvent(this.env, 'room_created'));
      return json({ code, token, playerId });
    }

    const room = await this.load();
    if (!room) return json({ error: 'no-room' }, 404);

    if (url.pathname === '/join') {
      const { nick, aid } = await request.json().catch(() => ({}));
      const token = crypto.randomUUID();
      const playerId = newId();
      const res = joinRoom(room, { nick, token, playerId, now, aid });
      if (res.error) return json({ error: res.error }, 400);
      await this.commit(res.room);
      return json({ code: room.code, token, playerId });
    }

    // WebSocket: the temporary token (never the nickname) identifies the player. It
    // comes as a WebSocket subprotocol ("warzil", token) so it stays out of URLs and logs.
    if (request.headers.get('Upgrade') === 'websocket') {
      const protocols = (request.headers.get('Sec-WebSocket-Protocol') ?? '').split(',').map((s) => s.trim());
      const token = protocols[0] === 'warzil' ? protocols[1] : url.searchParams.get('token');
      const player = playerByToken(room, token);
      if (!player) return json({ error: 'token' }, 403);
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server, [player.id]);
      await this.commit(setConnected(room, player.id, true, now).room);
      const headers = protocols[0] === 'warzil' ? { 'Sec-WebSocket-Protocol': 'warzil' } : {};
      return new Response(null, { status: 101, webSocket: client, headers });
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
    const loaded = await this.load();
    if (!loaded) return;
    const now = Date.now();
    const room = ensureHost(loaded, now);
    let res;
    switch (msg.type) {
      case 'resume':
        res = resumeControl(room, playerId, now);
        break;
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
      // Even a rejected action may advance the duplicate guard; keep it. A host
      // change found on the way is shown to everybody.
      if (room !== loaded) await this.commit(res.room);
      else if (res.room !== room) await this.save(res.room);
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
    const loaded = await this.load();
    if (!loaded) return;
    const now = Date.now();
    const room = ensureHost(loaded, now);
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
    if (room !== loaded) await this.commit(room);
    else await this.schedule(room);
  }
}

// Per-IP rate limits (room creation, failed joins), one object per IP and purpose.
// /hit records an attempt if still allowed; /check only looks.
const WINDOW_MS = 10 * 60 * 1000;

export class Limiter extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    const max = Math.max(1, Number(url.searchParams.get('max')) || 30);
    const now = Date.now();
    const hits = ((await this.ctx.storage.get('hits')) ?? []).filter((t) => now - t < WINDOW_MS);
    const allowed = hits.length < max;
    if (url.pathname === '/check') return json({ allowed });
    if (allowed) hits.push(now);
    await this.ctx.storage.put('hits', hits);
    await this.ctx.storage.setAlarm(now + WINDOW_MS);
    return json({ allowed });
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
