// Durable Object holding the usage counters (see ./metrics.js).
import { DurableObject } from 'cloudflare:workers';
import { METRIC_EVENTS, metricDay, summarize } from './metrics.js';

export class Metrics extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS counts (day TEXT NOT NULL, event TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, event))');
    });
  }

  add(event) {
    if (!METRIC_EVENTS.includes(event)) return false;
    this.ctx.storage.sql.exec('INSERT INTO counts (day, event, n) VALUES (?, ?, 1) ON CONFLICT (day, event) DO UPDATE SET n = n + 1', metricDay(), event);
    return true;
  }

  report(days = 30) {
    const since = metricDay(Date.now() - days * 86400000);
    return summarize(this.ctx.storage.sql.exec('SELECT day, event, n FROM counts WHERE day > ? ORDER BY day DESC', since).toArray());
  }
}

// One global counter object. Errors never reach players: metrics are best-effort.
export async function countEvent(env, event) {
  try {
    await env.METRICS?.get(env.METRICS.idFromName('global')).add(event);
  } catch {
    // ignore
  }
}
