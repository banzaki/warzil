// Player preferences, saved in this browser only (no account, no server).
// None of them touch the game rules or the dice: they change pace, sound,
// motion and how reinforcements are placed.
const STORAGE_KEY = 'warzil-settings';

export const SETTING_OPTIONS = {
  sound: [false, true],
  animations: ['normal', 'reduced'],
  aiSpeed: ['normal', 'fast', 'veryFast'],
  reinforce: ['one', 'five', 'all', 'picker'],
  // Starting armies per state, chosen when setting up a match.
  armies: [1, 2, 3, 'mixed'],
};

export const DEFAULT_SETTINGS = {
  sound: false,
  animations: 'normal',
  // "Rápida" (2x) became the default in v0.7.1.
  aiSpeed: 'fast',
  reinforce: 'one',
  armies: 1,
};

// Multiplies the delay between AI actions in player matches (see pace.js).
export { SPEED_FACTOR as AI_SPEED_FACTOR } from './pace.js';

// Troops per tap for each reinforcement mode ('picker' asks every time).
export const REINFORCE_AMOUNT = { one: 1, five: 5, all: 'all', picker: 'picker' };

function defaultStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

// Unknown keys are dropped and invalid values fall back to the default.
// aiSpeedChosen: true once the player picks a speed in the settings sheet.
// Older saves stored aiSpeed 'normal' just because it was the default then; those
// move to the new default, while an explicit choice is always kept.
export function sanitize(raw) {
  const out = { ...DEFAULT_SETTINGS, aiSpeedChosen: false };
  if (raw && typeof raw === 'object') {
    for (const [key, options] of Object.entries(SETTING_OPTIONS)) {
      if (options.includes(raw[key])) out[key] = raw[key];
    }
    out.aiSpeedChosen = raw.aiSpeedChosen === true;
    if (!out.aiSpeedChosen && raw.aiSpeed === 'normal') out.aiSpeed = DEFAULT_SETTINGS.aiSpeed;
  }
  return out;
}

export function loadSettings(storage = defaultStorage()) {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    return sanitize(text ? JSON.parse(text) : null);
  } catch {
    return sanitize(null);
  }
}

export function saveSettings(settings, storage = defaultStorage()) {
  const clean = sanitize(settings);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Private mode or blocked storage: settings still apply for this visit.
  }
  return clean;
}

export function resetSettings(storage = defaultStorage()) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
  return sanitize(null);
}
