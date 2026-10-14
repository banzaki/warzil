// Product analytics (PostHog, sent over its plain HTTP API: no SDK, no cookies,
// no autocapture, no session replay). Only game events with technical
// properties: never nicknames, room codes or tokens, Pix data or full URLs with
// query strings. Each browser gets a random anonymous id; a "session" is a run
// of activity with less than 30 minutes of silence.
// Off when no key is configured, when the player turns "Estatísticas anônimas"
// off in the settings, or when the browser sends Global Privacy Control.
const ENV = import.meta.env ?? {};
const KEY = ENV.VITE_POSTHOG_KEY || '';
const HOST = (ENV.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com').replace(/\/$/, '');
const RELEASE = ENV.VITE_RELEASE || 'dev';
const STAGE = ENV.MODE === 'production' ? 'production' : ENV.MODE || 'dev';

const AID_KEY = 'warzil-aid';
const SID_KEY = 'warzil-sid';
export const SESSION_GAP_MS = 30 * 60 * 1000;
const FLUSH_MS = 2000;

// ---------- Pure helpers (tested) ----------

// UUIDv7: 48-bit millisecond timestamp + random bits (PostHog sessions need it).
export function uuidv7(now = Date.now(), random = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = random(16);
  let ts = BigInt(now);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number(ts & 0xffn);
    ts >>= 8n;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);

// Same session while activity keeps coming less than 30 minutes apart.
export function nextSession(saved, now) {
  if (saved && isUuid(saved.id) && now - saved.last < SESSION_GAP_MS) return { id: saved.id, last: now };
  return { id: uuidv7(now), last: now };
}

// Campaign tags from the address (?utm_source=tiktok...), nothing else.
export function utmFrom(search) {
  const params = new URLSearchParams(search);
  const out = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const v = params.get(k);
    if (v) out[k] = v.slice(0, 100);
  }
  return out;
}

// Where the visit came from: only the other site's address, never its path or query.
export function referrerOf(referrer, ownHost) {
  try {
    const url = new URL(referrer);
    if (url.host === ownHost) return {};
    return { $referrer: url.origin, $referring_domain: url.host };
  } catch {
    return { $referrer: '$direct', $referring_domain: '$direct' };
  }
}

export function deviceType(width, coarsePointer) {
  if (width < 768 && coarsePointer) return 'Mobile';
  if (width < 1100 && coarsePointer) return 'Tablet';
  return 'Desktop';
}

// ---------- Browser state ----------

let enabled = false;
let queue = [];
let timer = null;

function store(kind) {
  try {
    return kind === 'session' ? sessionStorage : localStorage;
  } catch {
    return null;
  }
}

function readJson(key) {
  try {
    return JSON.parse(store('local')?.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function anonId() {
  const s = store('local');
  let id = s?.getItem(AID_KEY);
  if (!isUuid(id)) {
    id = crypto.randomUUID();
    try {
      s?.setItem(AID_KEY, id);
    } catch {
      // Without storage the id lasts for this page only.
    }
  }
  return id;
}

function sessionId(now) {
  const next = nextSession(readJson(SID_KEY), now);
  try {
    store('local')?.setItem(SID_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next.id;
}

const gpc = () => typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true;

// The anonymous id the server may use for online-room events (null when off).
export function analyticsId() {
  return enabled ? anonId() : null;
}

export function setAnalyticsEnabled(on) {
  enabled = Boolean(KEY) && on !== false && !gpc();
  if (!enabled) queue = [];
}

function common(now) {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return {
    $session_id: sessionId(now),
    $process_person_profile: false,
    $lib: 'warzil-web',
    $current_url: location.origin + location.pathname,
    $host: location.host,
    $pathname: location.pathname,
    $device_type: deviceType(window.innerWidth, coarse),
    $screen_width: window.screen?.width,
    $screen_height: window.screen?.height,
    $viewport_width: window.innerWidth,
    env: STAGE,
    release: RELEASE,
  };
}

function flush(useBeacon = false) {
  clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const body = JSON.stringify({ api_key: KEY, batch: queue });
  queue = [];
  try {
    if (useBeacon && navigator.sendBeacon?.(`${HOST}/batch/`, new Blob([body], { type: 'text/plain' }))) return;
    // text/plain keeps it a "simple" request (no CORS preflight); PostHog reads the JSON body.
    fetch(`${HOST}/batch/`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body, keepalive: true }).catch(() => {});
  } catch {
    // Analytics never gets in the way of the game.
  }
}

export function capture(event, properties = {}) {
  if (!enabled) return;
  try {
    const now = Date.now();
    queue.push({ event, distinct_id: anonId(), timestamp: new Date(now).toISOString(), properties: { ...common(now), ...properties } });
    if (!timer) timer = setTimeout(flush, FLUSH_MS);
  } catch {
    // ignore
  }
}

// Once per page load.
let viewed = false;
export function capturePageview() {
  if (viewed || !enabled) return;
  viewed = true;
  capture('$pageview', { ...referrerOf(document.referrer, location.host), ...utmFrom(location.search) });
}

// ---------- Matches ----------
// One record per match: started once, then either completed or abandoned once.

let current = null;

// meta: { mode, candidate?, humans, ai, participants, armies, deal, rematch? }
export function startMatch(meta) {
  if (current && !current.closed) abandonMatch(current, null, null, 'replaced');
  current = { id: crypto.randomUUID?.() ?? uuidv7(), startedAt: Date.now(), closed: false, meta };
  capture('match_started', { match_id: current.id, ...meta });
  if (meta.rematch) capture('rematch_started', { match_id: current.id, mode: meta.mode });
  return current;
}

const clockProps = (clock) =>
  clock ? { active_s: clock.active, waiting_s: clock.waiting, idle_s: clock.idle, hidden_s: clock.hidden } : {};

export function completeMatch(match, props, clock) {
  if (!match || match.closed) return;
  match.closed = true;
  capture('match_completed', {
    match_id: match.id,
    ...match.meta,
    ...props,
    duration_s: Math.round((Date.now() - match.startedAt) / 1000),
    ...clockProps(clock),
  });
}

export function abandonMatch(match, round, clock, reason) {
  if (!match || match.closed) return;
  match.closed = true;
  capture('match_abandoned', {
    match_id: match.id,
    ...match.meta,
    reason,
    round_reached: round ?? undefined,
    duration_s: Math.round((Date.now() - match.startedAt) / 1000),
    ...clockProps(clock),
  });
}

// The page going away mid-match counts as leaving it (sent with sendBeacon).
let lastSeen = { round: null, clock: null };
export function noteProgress(round, clock) {
  lastSeen = { round, clock };
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (current && !current.closed) abandonMatch(current, lastSeen.round, lastSeen.clock, 'page_closed');
    flush(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
}
