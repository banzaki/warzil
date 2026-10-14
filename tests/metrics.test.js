import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT_EVENTS, METRIC_EVENTS, SERVER_EVENTS, metricDay, summarize } from '../worker/metrics.js';

test('metric days follow Brasília time', () => {
  assert.equal(metricDay(Date.parse('2026-10-15T02:59:00Z')), '2026-10-14');
  assert.equal(metricDay(Date.parse('2026-10-15T03:00:00Z')), '2026-10-15');
});

test('browsers can only report their own events; online ones are counted by the server', () => {
  for (const e of SERVER_EVENTS) assert.ok(!CLIENT_EVENTS.includes(e), e);
  assert.equal(new Set(METRIC_EVENTS).size, METRIC_EVENTS.length);
  for (const e of ['solo_start', 'solo_end', 'local_start', 'local_end', 'room_created', 'online_start', 'online_end', 'conn_error']) assert.ok(METRIC_EVENTS.includes(e), e);
});

test('report adds up totals and lists the newest day first', () => {
  const r = summarize([
    { day: '2026-10-14', event: 'solo_start', n: 3 },
    { day: '2026-10-15', event: 'solo_start', n: 2 },
    { day: '2026-10-15', event: 'local_end', n: 1 },
  ]);
  assert.deepEqual(r.totals, { solo_start: 5, local_end: 1 });
  assert.deepEqual(Object.keys(r.days), ['2026-10-15', '2026-10-14']);
  assert.equal(r.days['2026-10-15'].local_end, 1);
});
