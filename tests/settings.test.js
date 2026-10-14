import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AI_SPEED_FACTOR, DEFAULT_SETTINGS, REINFORCE_AMOUNT, loadSettings, resetSettings, sanitize, saveSettings } from '../src/game/settings.js';

// In-memory stand-in for localStorage.
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}
const brokenStorage = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
  removeItem() {
    throw new Error('blocked');
  },
};

test('defaults: sound off, AI at 2x ("Rápida"), one reinforcement per tap', () => {
  assert.deepEqual(loadSettings(memoryStorage()), { ...DEFAULT_SETTINGS, aiSpeedChosen: false });
  assert.equal(DEFAULT_SETTINGS.sound, false);
  assert.equal(DEFAULT_SETTINGS.aiSpeed, 'fast');
  assert.equal(DEFAULT_SETTINGS.reinforce, 'one');
});

test('old saves move to the new speed default; explicit choices are kept', () => {
  const storage = memoryStorage();
  storage.setItem('warzil-settings', JSON.stringify({ sound: true, aiSpeed: 'normal' })); // v0.6 save
  assert.equal(loadSettings(storage).aiSpeed, 'fast');
  assert.equal(loadSettings(storage).sound, true, 'other choices kept');
  storage.setItem('warzil-settings', JSON.stringify({ aiSpeed: 'veryFast' }));
  assert.equal(loadSettings(storage).aiSpeed, 'veryFast', 'a non-default speed was a real choice');
  storage.setItem('warzil-settings', JSON.stringify({ aiSpeed: 'normal', aiSpeedChosen: true }));
  assert.equal(loadSettings(storage).aiSpeed, 'normal', 'Normal picked explicitly stays Normal');
});

test('settings persist and restore', () => {
  const storage = memoryStorage();
  const chosen = { sound: true, animations: 'reduced', aiSpeed: 'veryFast', reinforce: 'picker', armies: 'mixed', analytics: false, aiSpeedChosen: true };
  saveSettings(chosen, storage);
  assert.deepEqual(loadSettings(storage), chosen);
  assert.deepEqual(resetSettings(storage), { ...DEFAULT_SETTINGS, aiSpeedChosen: false });
  assert.deepEqual(loadSettings(storage), { ...DEFAULT_SETTINGS, aiSpeedChosen: false });
});

test('invalid or unknown values fall back to defaults', () => {
  assert.deepEqual(sanitize({ sound: 'yes', aiSpeed: 'warp', reinforce: 'all', hacker: 1 }), { ...DEFAULT_SETTINGS, reinforce: 'all', aiSpeedChosen: false });
  const storage = memoryStorage();
  storage.setItem('warzil-settings', '{not json');
  assert.deepEqual(loadSettings(storage), { ...DEFAULT_SETTINGS, aiSpeedChosen: false });
});

test('blocked storage never breaks the game', () => {
  const defaults = { ...DEFAULT_SETTINGS, aiSpeedChosen: false };
  assert.deepEqual(loadSettings(brokenStorage), defaults);
  assert.deepEqual(saveSettings({ ...DEFAULT_SETTINGS, sound: true }, brokenStorage), { ...defaults, sound: true });
  assert.deepEqual(resetSettings(brokenStorage), defaults);
  assert.deepEqual(loadSettings(null), defaults);
});

test('every option maps to a pace or a placement amount', () => {
  assert.ok(AI_SPEED_FACTOR.fast < AI_SPEED_FACTOR.normal && AI_SPEED_FACTOR.veryFast < AI_SPEED_FACTOR.fast);
  assert.deepEqual(Object.values(REINFORCE_AMOUNT), [1, 5, 'all', 'picker']);
});

test('the rules engine and AI never read settings (no hidden effect on dice)', () => {
  for (const file of ['engine.js', 'ai.js', 'simulation.js']) {
    const src = readFileSync(new URL(`../src/game/${file}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('settings'), `${file} must not depend on settings`);
  }
});
