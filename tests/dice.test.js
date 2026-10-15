import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairResults, rollSummary } from '../src/game/dice.js';
import { attack, blitz, createGame } from '../src/game/engine.js';
import { seededRng } from '../src/game/daily.js';
import { STATE_IDS } from '../src/game/data.js';

test('the text shows the real dice and losses, in the reported format', () => {
  const roll = { attackerDice: [6, 4, 2], defenderDice: [5, 4, 1], attackerLoss: 1, defenderLoss: 2 };
  const s = rollSummary(roll);
  assert.equal(s.dice, 'ATAQUE: 6, 4, 2 | DEFESA: 5, 4, 1');
  assert.equal(s.result, 'Resultado: atacante perde 1, defensor perde 2.');
  assert.equal(s.tie, 'Empate (4 × 4) é da defesa.');
  assert.deepEqual(pairResults(roll), { att: ['win', 'tie', 'win'], def: ['lose', 'win', 'lose'] });
  // Unpaired dice are shown but not compared.
  assert.deepEqual(pairResults({ attackerDice: [3, 2], defenderDice: [6] }), { att: ['lose', 'idle'], def: ['win'] });
});

test('every roll on screen is the engine’s own roll; "Tudo ou nada" adds the totals', () => {
  const g0 = createGame('lula', seededRng(4), undefined, { fixedOrder: true });
  const owner = Object.fromEntries(STATE_IDS.map((id) => [id, 'lula']));
  owner.pr = 'flavio';
  const g = { ...g0, owner, phase: 'attack', current: 'lula', troops: { ...g0.troops, sp: 12, pr: 6 } };
  const one = attack(g, 'sp', 'pr', seededRng(7));
  const s = rollSummary(one.lastRoll);
  assert.equal(s.dice, `ATAQUE: ${one.lastRoll.attackerDice.join(', ')} | DEFESA: ${one.lastRoll.defenderDice.join(', ')}`);
  assert.equal(one.lastRoll.attackerLoss + one.lastRoll.defenderLoss, Math.min(one.lastRoll.attackerDice.length, one.lastRoll.defenderDice.length));
  const all = blitz(g, 'sp', 'pr', seededRng(7));
  const { series } = all.lastRoll;
  assert.ok(series.rolls >= 2);
  assert.equal(12 - series.attackerLoss, all.troops.sp + (all.owner.pr === 'lula' ? all.troops.pr : 0));
  if (all.owner.pr === 'lula') assert.equal(series.defenderLoss, 6, 'PR fell: all 6 defenders lost');
  else assert.equal(all.troops.sp, 1, 'SP ran out of dice');
});
