// Tiny synthesized sound effects (Web Audio, no audio files).
// The AudioContext is created lazily on the first sound, which always follows a
// user tap, so browser autoplay rules are respected. On/off lives in settings.js
// (off by default); App calls setMuted() whenever the setting changes.
let ctx = null;
let muted = true;
let lastDice = 0;

export function setMuted(value) {
  muted = value;
}

function audio() {
  if (ctx) return ctx;
  const AudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  return ctx;
}

function tone(freq, start, duration, { type = 'square', volume = 0.05 } = {}) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

const SOUNDS = {
  dice: () => [0, 0.05, 0.1].forEach((s, i) => tone(180 + i * 60, s, 0.04, { type: 'triangle', volume: 0.04 })),
  conquer: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.12)),
  region: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.14)),
  eliminate: () => [440, 330, 220].forEach((f, i) => tone(f, i * 0.12, 0.2, { type: 'sawtooth', volume: 0.04 })),
  victory: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.18)),
  defeat: () => [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.16, 0.25, { type: 'triangle' })),
};

export function play(name) {
  if (muted || !SOUNDS[name]) return;
  const now = Date.now();
  // Fast simulations roll dice every ~100 ms; keep the clicks from piling up.
  if (name === 'dice') {
    if (now - lastDice < 150) return;
    lastDice = now;
  }
  try {
    const ac = audio();
    if (ac?.state === 'suspended') ac.resume();
    SOUNDS[name]();
  } catch {
    // Audio is a nice-to-have; never let it break the game.
  }
}
