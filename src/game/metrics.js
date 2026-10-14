// Anonymous usage counters (see worker/metrics.js): only the event name is sent.
// Best-effort: failures are ignored and nothing is sent while developing locally.
export function track(event) {
  if (import.meta.env?.DEV) return;
  try {
    const body = JSON.stringify({ e: event });
    if (navigator.sendBeacon?.('/api/event', new Blob([body], { type: 'application/json' }))) return;
    fetch('/api/event', { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch {
    // ignore
  }
}

// Connection trouble is reported at most once a minute per page.
let lastConnError = 0;
export function trackConnError(now = Date.now()) {
  if (now - lastConnError < 60000) return;
  lastConnError = now;
  track('conn_error');
}
