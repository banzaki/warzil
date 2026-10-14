// WARZIL Worker: serves the built game (static assets) and the online API.
//   POST /api/rooms                 create a room   { nick } -> { code, token, playerId }
//   POST /api/rooms/:code/join      join a room     { nick } -> { code, token, playerId }
//   GET  /api/rooms/:code/ws        WebSocket for an existing player; the token travels
//                                   in the Sec-WebSocket-Protocol header, not in the URL
//   POST /api/event                 usage counter { e: event name } (see metrics.js)
//   GET  /api/stats?key=…           daily counters; needs the STATS_KEY secret
export { RoomObject, Limiter } from './room-object.js';
export { Metrics } from './metrics-object.js';
import { CODE_CHARS, CODE_LENGTH, LEGACY_CODE_LENGTH, randomCode } from './codes.js';
import { CLIENT_EVENTS } from './metrics.js';
import { countEvent } from './metrics-object.js';

const MAX_BODY = 1024;
// Failed joins (unknown room) allowed per IP per 10 minutes: a typo costs one,
// guessing codes stops quickly.
const MAX_FAILED_JOINS = 20;
// Room creations per IP per 10 minutes. Generous on purpose: mobile carriers put
// many people behind one IP.
const MAX_ROOMS = 30;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const roomStub = (env, code) => env.ROOMS.get(env.ROOMS.idFromName(code));

// Per-IP counters (one Limiter object per IP and purpose). `count` records a hit.
async function limiter(env, request, purpose, max, count) {
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  const stub = env.LIMITER.get(env.LIMITER.idFromName(`${purpose}:${ip}`));
  const res = await stub.fetch(`https://limiter/${count ? 'hit' : 'check'}?max=${max}`, { method: 'POST' });
  return (await res.json()).allowed;
}

// Usage events per IP and 10 minutes, counted in this Worker instance's memory
// only (cheap; it just keeps one page from flooding the counters).
const MAX_EVENTS = 40;
const EVENT_WINDOW_MS = 10 * 60 * 1000;
const eventHits = new Map();
function eventAllowed(request, now = Date.now()) {
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  if (eventHits.size > 5000) eventHits.clear();
  const hit = eventHits.get(ip);
  if (!hit || now > hit.reset) {
    eventHits.set(ip, { n: 1, reset: now + EVENT_WINDOW_MS });
    return true;
  }
  hit.n += 1;
  return hit.n <= MAX_EVENTS;
}

const CODE_PATTERN = new RegExp(`^/api/rooms/([${CODE_CHARS}]{${LEGACY_CODE_LENGTH}}|[${CODE_CHARS}]{${CODE_LENGTH}})/(join|ws)$`);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (url.pathname === '/api/event' && request.method === 'POST') {
      const body = await readBody(request);
      if (body && CLIENT_EVENTS.includes(body.e) && eventAllowed(request)) await countEvent(env, body.e);
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/api/stats' && request.method === 'GET') {
      const key = url.searchParams.get('key');
      if (!env.STATS_KEY || env.STATS_KEY.length < 16 || key !== env.STATS_KEY) return json({ error: 'forbidden' }, 403);
      const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 30));
      return json(await env.METRICS.get(env.METRICS.idFromName('global')).report(days));
    }

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      if (!(await limiter(env, request, 'create', MAX_ROOMS, true))) return json({ error: 'rate-limited' }, 429);
      const body = await readBody(request);
      if (!body) return json({ error: 'body' }, 400);
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomCode();
        const res = await roomStub(env, code).fetch('https://room/create', {
          method: 'POST',
          body: JSON.stringify({ code, nick: body.nick, aid: body.aid }),
        });
        if (res.status !== 409) return res;
      }
      return json({ error: 'busy' }, 503);
    }

    const match = url.pathname.match(CODE_PATTERN);
    if (url.pathname.match(/^\/api\/rooms\/[^/]+\/join$/) && request.method === 'POST') {
      // Too many wrong codes from this connection: stop answering for a while.
      if (!(await limiter(env, request, 'join', MAX_FAILED_JOINS, false))) return json({ error: 'join-limited' }, 429);
      const body = match && (await readBody(request));
      const res = body ? await roomStub(env, match[1]).fetch('https://room/join', { method: 'POST', body: JSON.stringify({ nick: body.nick, aid: body.aid }) }) : null;
      if (!res || res.status === 404) {
        await limiter(env, request, 'join', MAX_FAILED_JOINS, true);
        return res ?? json({ error: 'no-room' }, 404);
      }
      return res;
    }
    if (match) {
      const [, code, route] = match;
      if (route === 'ws') {
        if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'upgrade' }, 426);
        return roomStub(env, code).fetch(request);
      }
    }
    return json({ error: 'not-found' }, 404);
  },
};
