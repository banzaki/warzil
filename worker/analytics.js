// Server-side product analytics for online rooms (PostHog HTTP API). The room is
// the authority on matches, so starts, results, rematches, departures and
// connection changes are derived here from state changes: reconnects and
// reloads can never count a match twice. Events go only to players whose
// browser sent its anonymous analytics id (absent when they opted out).
// Never sent: nicknames, tokens, room codes.

export const isAid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);

const humans = (room) => room.players.filter((p) => p.faction && room.controllers?.[p.faction] === p.id);

function matchProps(room) {
  const game = room.game;
  const human = humans(room).length;
  return {
    mode: 'online',
    match_id: room.matchRef ?? null,
    participants: game?.factions.length ?? 0,
    humans: human,
    ai: (game?.factions.length ?? 0) - human,
    armies: String(room.settings?.armies ?? 1),
    deal: game?.deal ?? 'random',
  };
}

// Events implied by going from `before` to `room` (either may be null).
// Returns [{ event, aid, props }].
export function roomEvents(before, room, now) {
  const out = [];
  if (!room) return out;
  const add = (p, event, props) => p?.aid && out.push({ event, aid: p.aid, props });
  const prev = new Map((before?.players ?? []).map((p) => [p.id, p]));

  if (!before) add(room.players[0], 'room_created', { mode: 'online' });
  for (const p of room.players) if (before && !prev.has(p.id)) add(p, 'room_joined', { mode: 'online' });

  const started = room.game && (room.matchNo ?? 0) > (before?.matchNo ?? 0);
  if (started) {
    const rematch = before?.status === 'over';
    for (const p of humans(room)) add(p, 'match_started', { ...matchProps(room), candidate: p.faction, is_host: p.id === room.hostId, rematch });
    if (rematch) add(room.players.find((p) => p.id === room.hostId), 'rematch_started', { mode: 'online', match_id: room.matchRef ?? null });
  }

  if (before?.status === 'playing' && room.status === 'playing' && !started) {
    for (const p of room.players) {
      const was = prev.get(p.id);
      if (!was) continue;
      if (!was.left && p.left) add(p, 'match_abandoned', { ...matchProps(room), candidate: p.faction, reason: 'left_room', round_reached: room.game?.round });
      else if (was.connected && !p.connected && !p.left) add(p, 'online_disconnected', { mode: 'online', match_id: room.matchRef ?? null, round: room.game?.round });
      else if (!was.connected && p.connected) add(p, 'online_reconnected', { mode: 'online', match_id: room.matchRef ?? null, round: room.game?.round });
    }
  }

  if (before?.status === 'playing' && room.status === 'over' && room.game) {
    const duration = room.startedAt ? Math.round((now - room.startedAt) / 1000) : null;
    for (const p of humans(room)) {
      add(p, 'match_completed', {
        ...matchProps(room),
        candidate: p.faction,
        result: room.game.winner === p.faction ? 'win' : 'loss',
        winner: room.game.winner,
        rounds: room.game.round,
        duration_s: duration,
        left_before_end: Boolean(p.left),
      });
    }
  }
  return out;
}

// Sends events; never throws and never delays the room (use with waitUntil).
export async function sendEvents(env, events) {
  if (!env.POSTHOG_KEY || !events.length) return;
  const host = (env.POSTHOG_HOST || 'https://eu.i.posthog.com').replace(/\/$/, '');
  const timestamp = new Date().toISOString();
  const batch = events.map(({ event, aid, props }) => ({
    event,
    distinct_id: aid,
    timestamp,
    properties: { ...props, $process_person_profile: false, $geoip_disable: true, $lib: 'warzil-worker', env: env.ANALYTICS_ENV || 'dev', source: 'server' },
  }));
  try {
    await fetch(`${host}/batch/`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ api_key: env.POSTHOG_KEY, batch }) });
  } catch {
    // Analytics must never affect the game.
  }
}
