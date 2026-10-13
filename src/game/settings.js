// Player preferences, saved in this browser only (no account, no server).
// None of them touch the game rules or the dice: they change pace, sound,
// motion and how reinforcements are placed.
const STORAGE_KEY = 'warzil-settings';

export const SETTING_OPTIONS = {
  sound: [false, true],
  animations: ['normal', 'reduced'],
  aiSpeed: ['normal', 'fast', 'veryFast'],
  reinforce: ['one', 'five', 'all', 'picker'],
};

export const DEFAULT_SETTINGS = {
  sound: false,
  animations: 'normal',
  aiSpeed: 'normal',
  reinforce: 'one',
};

// Multiplies the delay between AI actions in player matches.
export const AI_SPEED_FACTOR = { normal: 1, fast: 0.55, veryFast: 0.3 };

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
export function sanitize(raw) {
  const out = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === 'object') {
    for (const [key, options] of Object.entries(SETTING_OPTIONS)) {
      if (options.includes(raw[key])) out[key] = raw[key];
    }
  }
  return out;
}

export function loadSettings(storage = defaultStorage()) {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    return sanitize(text ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
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
  return { ...DEFAULT_SETTINGS };
}
