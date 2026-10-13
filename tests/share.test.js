import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardModel, isLocalUrl, publicUrl, shareText } from '../src/game/share.js';
import { createDailyGame, dailyChallenge, seededRng } from '../src/game/daily.js';
import { createGame } from '../src/game/engine.js';

test('local addresses are never used on public cards', () => {
  for (const url of ['http://localhost:5173', 'http://127.0.0.1:5174/', 'http://192.168.0.10:5173', 'http://10.0.0.2', 'http://meupc.local:5173', 'nonsense']) {
    assert.equal(isLocalUrl(url), true, url);
  }
  assert.equal(isLocalUrl('https://warzil.vercel.app'), false);
  assert.equal(publicUrl(undefined, 'http://localhost:5173'), null);
  assert.equal(publicUrl('', 'https://warzil.vercel.app/'), 'https://warzil.vercel.app');
  assert.equal(publicUrl('https://warzil.com.br/', 'http://localhost:5173'), 'https://warzil.com.br');
  assert.equal(publicUrl('http://localhost:3000', 'http://127.0.0.1'), null);
});

function finished(game, winner, round) {
  return { ...game, phase: 'over', winner, round };
}

test('share text: player win, player loss, simulation and daily challenge', () => {
  const duel = createGame('lula', seededRng(3));
  const win = shareText(cardModel(finished(duel, 'lula', 9), { quote: 'Picanha liberada.', url: 'https://warzil.vercel.app' }));
  assert.match(win, /Venci o WARZIL jogando de Lula em 9 rodadas, com 2 candidatos/);
  assert.match(win, /“Picanha liberada.”/);
  assert.match(win, /Jogue: https:\/\/warzil.vercel.app/);
  assert.match(win, /Sátira fictícia/);

  const loss = shareText(cardModel(finished(duel, 'flavio', 12), { quote: 'x' }));
  assert.match(loss, /Flávio venceu o WARZIL \(eu joguei de Lula\) em 12 rodadas/);
  assert.doesNotMatch(loss, /Jogue:/, 'no address line without a public URL');

  const sim = createGame('cury', seededRng(3), ['renan', 'caiado'], { spectator: true });
  assert.match(shareText(cardModel(finished(sim, 'renan', 11), { quote: 'x' })), /Renan venceu a simulação do WARZIL em 11 rodadas, com 3 candidatos/);

  const daily = createDailyGame(dailyChallenge('2026-10-13'));
  const text = shareText(cardModel(finished(daily, daily.human, 8), { quote: 'x' }));
  assert.match(text, /📅 Desafio do dia 13\/10\/2026/);
  for (const t of [win, loss, text]) assert.doesNotMatch(t, /localhost|127\.0\.0\.1/);
});

test('card model carries what the image needs', () => {
  const g = finished(createGame('renan', seededRng(4), ['lula', 'flavio']), 'renan', 7);
  const m = cardModel(g, { quote: 'Live amanhã.' });
  assert.equal(m.winnerName, 'Renan');
  assert.equal(m.factionCount, 3);
  assert.equal(m.rounds, 7);
  assert.equal(Object.keys(m.owner).length, 27);
  assert.equal(m.daily, null);
});
