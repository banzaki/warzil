// v0.8.1 screen logic: speech queue, dice pop-up placement, result wording.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MS, MAX_WAITING, MIN_MS, enqueue, readMs, takeNext } from '../src/game/speech.js';
import { placeHud } from '../src/game/hudPlace.js';
import { rollOutcome } from '../src/game/dice.js';

const ev = (id, type) => ({ id, type });

test('speech: reading time grows with the line, within limits', () => {
  assert.equal(readMs('Oi'), MIN_MS);
  assert.equal(readMs('um dois três quatro cinco seis sete oito nove dez'), 3900);
  assert.equal(readMs(Array(60).fill('palavra').join(' ')), MAX_MS);
});

test('speech: one line at a time; ordinary lines give way, important ones never', () => {
  let q = enqueue([], [ev(1, 'turn'), ev(2, 'conquer'), ev(3, 'conquer'), ev(4, 'conquer')]);
  assert.equal(q.length, MAX_WAITING);
  assert.deepEqual(q.map((e) => e.id), [3, 4], 'the turn line and the oldest conquest were dropped');
  q = enqueue(q, [ev(5, 'region'), ev(6, 'eliminated'), ev(7, 'lead')]);
  assert.deepEqual(q.map((e) => e.id), [5, 6, 7], 'important lines are all kept');
  const [first, rest] = takeNext(enqueue([], [ev(8, 'conquer'), ev(9, 'region')]));
  assert.equal(first.id, 9, 'the most important line goes first');
  assert.deepEqual(rest.map((e) => e.id), [8]);
  assert.deepEqual(enqueue([], [ev(10, 'occupy'), null]), [], 'events without lines are ignored');
});

test('dice pop-up: farthest free corner, never over the fight or the zoom buttons', () => {
  const area = { x: 0, y: 0, w: 390, h: 360 };
  const size = { w: 170, h: 110 };
  // Fight in the north-east: the pop-up goes to the south-west.
  assert.deepEqual(placeHud({ area, size, battle: [{ x: 300, y: 40, w: 24, h: 24 }, { x: 340, y: 60, w: 24, h: 24 }] }), { x: 8, y: 242 });
  // Fight in the south-west: north-east, unless the zoom buttons are there.
  const sw = [{ x: 20, y: 300, w: 24, h: 24 }];
  assert.deepEqual(placeHud({ area, size, battle: sw }), { x: 212, y: 8 });
  const zoomTopRight = { x: 330, y: 8, w: 48, h: 90 };
  const p = placeHud({ area, size, battle: sw, hard: [zoomTopRight] });
  assert.notDeepEqual(p, { x: 212, y: 8 });
  // The speech line at the bottom is avoided when another corner is free.
  const speech = { x: 0, y: 300, w: 390, h: 60 };
  const q = placeHud({ area, size, battle: [{ x: 180, y: 170, w: 24, h: 24 }], soft: [speech] });
  assert.equal(q.y, 8);
});

const names = { lula: 'Lula', flavio: 'Flávio', cury: 'Cury' };
const sn = (id) => ({ ro: 'Rondônia', am: 'o Amazonas' })[id];

test('dice result told from the viewer’s side', () => {
  const roll = { attacker: 'lula', defender: 'flavio', to: 'ro', attackerDice: [6, 4, 2], defenderDice: [5, 4], attackerLoss: 1, defenderLoss: 1, conquered: false };
  assert.equal(rollOutcome(roll, 'lula', names, sn).result, 'Você perdeu 1 • Inimigo perdeu 1');
  assert.equal(rollOutcome(roll, 'flavio', names, sn).result, 'Você perdeu 1 • Atacante perdeu 1');
  assert.equal(rollOutcome(roll, 'cury', names, sn).result, 'Lula perdeu 1 • Flávio perdeu 1');
  assert.equal(rollOutcome(roll, 'lula', names, sn).tie, 'Empate: a defesa vence');
  const won = { ...roll, defenderDice: [3], attackerLoss: 0, defenderLoss: 1, conquered: true };
  assert.equal(rollOutcome(won, 'lula', names, sn).result, 'Você não perdeu • Inimigo perdeu 1');
  assert.equal(rollOutcome(won, 'lula', names, sn).conquest, '🎉 Você conquistou Rondônia!');
  assert.equal(rollOutcome(won, 'flavio', names, sn).conquest, '😱 Você perdeu Rondônia');
  assert.equal(rollOutcome(won, null, names, sn).conquest, '🎉 Lula conquistou Rondônia');
  assert.equal(rollOutcome(won, 'lula', names, sn).tie, null);
  assert.equal(rollOutcome({ ...won, to: 'am' }, 'lula', names, sn).conquest, '🎉 Você conquistou o Amazonas!');
  const blitz = { ...won, series: { rolls: 4, attackerLoss: 3, defenderLoss: 6 } };
  assert.equal(rollOutcome(blitz, 'lula', names, sn).result, 'Você perdeu 3 • Inimigo perdeu 6', 'totals of the whole fight');
});
