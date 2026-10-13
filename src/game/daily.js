// "Desafio do dia": everybody who opens the challenge on the same day gets the
// same line-up, turn order and starting deal. Dice stay random on every attempt.
// No server: results are only kept in this browser.
import { createGame } from './engine.js';

// The day flips at midnight Brasília time (UTC−3; Brazil has no DST since 2019),
// wherever the player is.
export const DAILY_UTC_OFFSET_HOURS = -3;
const CANDIDATES = ['lula', 'flavio', 'cury', 'renan', 'caiado'];
const STORAGE_KEY = 'warzil-daily';
const KEEP_DAYS = 30;

export function dailyKey(now = new Date()) {
  return new Date(now.getTime() + DAILY_UTC_OFFSET_HOURS * 3600 * 1000).toISOString().slice(0, 10);
}

// "2026-10-13" -> "13/10/2026"
export const formatDailyKey = (key) => key.split('-').reverse().join('/');

// FNV-1a: turns the date string into a 32-bit seed.
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: small deterministic RNG.
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Line-up for a given day: 2-4 candidates in turn order; the player is the first.
export function dailyChallenge(key = dailyKey()) {
  const rng = seededRng(hash(`warzil-daily-${key}`));
  const size = 2 + Math.floor(rng() * 3);
  const pool = [...CANDIDATES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const factions = pool.slice(0, size);
  // The starting-army mode is part of the challenge, so everybody gets the same map.
  const armies = [1, 2, 3, 'mixed'][Math.floor(rng() * 4)];
  return { key, factions, human: factions[0], armies };
}

export function createDailyGame(challenge) {
  const { key, human, factions, armies } = challenge;
  return { ...createGame(human, seededRng(hash(`warzil-deal-${key}`)), factions.slice(1), { armies }), daily: key };
}

// ---------- Personal results (this browser only) ----------

function defaultStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadDailyRecords(storage = defaultStorage()) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveDailyRecords(records, storage = defaultStorage()) {
  // Keep only the most recent days so storage never grows without bound.
  const kept = Object.fromEntries(Object.entries(records).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, KEEP_DAYS));
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch {
    // Blocked storage: results just won't persist.
  }
  return kept;
}

const emptyDay = { attempts: 0, wins: 0, bestRounds: null };

export const dayRecord = (records, key) => ({ ...emptyDay, ...records[key] });

export function recordAttempt(records, key) {
  const day = dayRecord(records, key);
  return { ...records, [key]: { ...day, attempts: day.attempts + 1 } };
}

// Goal: win in as few rounds as possible.
export function recordResult(records, key, { won, rounds }) {
  const day = dayRecord(records, key);
  if (!won) return { ...records, [key]: day };
  const bestRounds = day.bestRounds === null ? rounds : Math.min(day.bestRounds, rounds);
  return { ...records, [key]: { ...day, wins: day.wins + 1, bestRounds } };
}
