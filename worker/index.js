// WARZIL Worker: serves the built game (static assets) and the online API.
//   POST /api/rooms                 create a room   { nick } -> { code, token, playerId }
//   POST /api/rooms/:code/join      join a room     { nick } -> { code, token, playerId }
//   GET  /api/rooms/:code/ws?token  WebSocket for an existing player
export { RoomObject, Limiter } from './room-object.js';

// No look-alike characters (0/O, 1/I/L).
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const MAX_BODY = 1024;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const ip = request.headers.get('cf-connecting-ip') ?? 'local';
      const limiter = env.LIMITER.get(env.LIMITER.idFromName(ip));
      const { allowed } = await (await limiter.fetch('https://limiter/hit', { method: 'POST' })).json();
      if (!allowed) return json({ error: 'rate-limited' }, 429);
      const body = await readBody(request);
      if (!body) return json({ error: 'body' }, 400);
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomCode();
        const res = await roomStub(env, code).fetch('https://room/create', {
          method: 'POST',
          body: JSON.stringify({ code, nick: body.nick }),
        });
        if (res.status !== 409) return res;
      }
      return json({ error: 'busy' }, 503);
    }

    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{5})\/(join|ws)$/);
    if (match) {
      const [, code, route] = match;
      if (route === 'join' && request.method === 'POST') {
        const body = await readBody(request);
        if (!body) return json({ error: 'body' }, 400);
        return roomStub(env, code).fetch('https://room/join', { method: 'POST', body: JSON.stringify({ nick: body.nick }) });
      }
      if (route === 'ws') {
        if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'upgrade' }, 426);
        return roomStub(env, code).fetch(request);
      }
    }
    return json({ error: 'not-found' }, 404);
  },
};
