import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDailyGame,
  dailyChallenge,
  dailyKey,
  dayRecord,
  formatDailyKey,
  loadDailyRecords,
  recordAttempt,
  recordResult,
  saveDailyRecords,
} from '../src/game/daily.js';
import { territoriesOf } from '../src/game/engine.js';

// "YYYY-MM-DD" n days after 2026-10-01.
const dayAfterStart = (n) => new Date(Date.UTC(2026, 9, 1 + n)).toISOString().slice(0, 10);

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
}

test('the day flips at midnight Brasília time, for everybody', () => {
  assert.equal(dailyKey(new Date('2026-10-13T02:59:59Z')), '2026-10-12'); // 23:59 in Brasília
  assert.equal(dailyKey(new Date('2026-10-13T03:00:00Z')), '2026-10-13'); // 00:00 in Brasília
  // Same instant seen from Lisbon or Manaus: same challenge.
  assert.equal(dailyKey(new Date('2026-10-13T12:00:00+01:00')), '2026-10-13');
  assert.equal(dailyKey(new Date('2026-10-13T01:30:00-04:00')), '2026-10-13');
  assert.equal(formatDailyKey('2026-10-13'), '13/10/2026');
});

test('same day -> identical line-up, order and starting deal', () => {
  const a = createDailyGame(dailyChallenge('2026-10-13'));
  const b = createDailyGame(dailyChallenge('2026-10-13'));
  assert.deepEqual(a.factions, b.factions);
  assert.equal(a.human, b.human);
  assert.deepEqual(a.owner, b.owner);
  assert.deepEqual(a.troops, b.troops);
  assert.equal(a.daily, '2026-10-13');
  assert.equal(a.armies, b.armies, 'same starting-army mode');
  assert.deepEqual(a.factions, b.factions, 'same drawn turn order');
  assert.equal(a.armies, dailyChallenge('2026-10-13').armies);
  assert.equal(a.human, a.factions[0]);
});

test('different days give different challenges, with 2 to 4 candidates', () => {
  const sizes = new Set();
  const deals = new Set();
  for (let d = 0; d < 60; d++) {
    const ch = dailyChallenge(dayAfterStart(d));
    sizes.add(ch.factions.length);
    assert.equal(new Set(ch.factions).size, ch.factions.length, 'no duplicates');
    const g = createDailyGame(ch);
    deals.add(JSON.stringify(g.owner));
    for (const f of g.factions) assert.ok(territoriesOf(g, f).length >= 6);
  }
  assert.deepEqual([...sizes].sort(), [2, 3, 4]);
  assert.equal(deals.size, 60);
});

test('attempts, wins and best rounds are tracked per day', () => {
  let r = {};
  r = recordAttempt(r, '2026-10-13');
  r = recordResult(r, '2026-10-13', { won: false, rounds: 7 });
  assert.deepEqual(dayRecord(r, '2026-10-13'), { attempts: 1, wins: 0, bestRounds: null });
  r = recordResult(recordAttempt(r, '2026-10-13'), '2026-10-13', { won: true, rounds: 12 });
  r = recordResult(recordAttempt(r, '2026-10-13'), '2026-10-13', { won: true, rounds: 9 });
  r = recordResult(recordAttempt(r, '2026-10-13'), '2026-10-13', { won: true, rounds: 15 });
  assert.deepEqual(dayRecord(r, '2026-10-13'), { attempts: 4, wins: 3, bestRounds: 9 });
  // A new day starts from zero.
  assert.deepEqual(dayRecord(r, '2026-10-14'), { attempts: 0, wins: 0, bestRounds: null });
});

test('records persist locally and old days are pruned', () => {
  const storage = memoryStorage();
  let r = {};
  for (let d = 0; d < 40; d++) r = recordAttempt(r, dayAfterStart(d));
  const kept = saveDailyRecords(r, storage);
  assert.equal(Object.keys(kept).length, 30);
  assert.ok(kept[dayAfterStart(39)] && !kept[dayAfterStart(0)], 'the most recent days are kept');
  assert.deepEqual(loadDailyRecords(storage), kept);
  assert.deepEqual(loadDailyRecords({ getItem: () => '{broken' }), {});
  assert.deepEqual(loadDailyRecords(null), {});
});
