// v0.8.1 Entrega 2: summary of the other candidates' turns, battle history.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { turnSummary } from '../src/game/summary.js';
import { MAX_BATTLES, recordBattle } from '../src/game/battles.js';
import { attack, blitz, createGame } from '../src/game/engine.js';
import { seededRng } from '../src/game/daily.js';
import { STATE_IDS } from '../src/game/data.js';

const names = { lula: 'Lula', flavio: 'Flávio', renan: 'Renan', cury: 'Cury' };
const regions = { southeast: 'Sudeste', south: 'Sul' };
let n = 0;
const ev = (type, faction, extra = {}) => ({ id: ++n, type, faction, ...extra });

test('one line per candidate: conquests (yours counted), regions, knock-outs', () => {
  const events = [
    ev('turn', 'flavio'),
    ev('conquer', 'flavio', { loser: 'lula', state: 'sp' }),
    ev('conquer', 'flavio', { loser: 'renan', state: 'rj' }),
    ev('conquer', 'flavio', { loser: 'lula', state: 'mg' }),
    ev('region', 'flavio', { region: 'southeast' }),
    ev('conquer', 'renan', { loser: 'cury', state: 'pr' }),
    ev('eliminated', 'renan', { loser: 'cury' }),
    ev('conquer', 'lula', { loser: 'flavio', state: 'ba' }),
  ];
  assert.deepEqual(turnSummary(events, 'lula', names, regions), [
    'Flávio conquistou 3 estados (2 seus) e dominou o Sudeste.',
    'Renan conquistou 1 estado e tirou Cury da disputa.',
  ]);
  assert.deepEqual(turnSummary([ev('conquer', 'flavio', { loser: 'lula' })], 'lula', names, regions), ['Flávio conquistou 1 estado (era seu).']);
  assert.deepEqual(turnSummary([ev('turn', 'flavio'), ev('bigLoss', 'flavio')], 'lula', names, regions), [], 'nothing worth a line');
  assert.equal(turnSummary(events, null, names, regions).length, 3, 'spectators see everybody');
});

test('battle history: official rolls, newest first, no duplicates, bounded', () => {
  const g0 = createGame('lula', seededRng(4), undefined, { fixedOrder: true });
  const owner = Object.fromEntries(STATE_IDS.map((id) => [id, 'lula']));
  owner.pr = 'flavio';
  let g = { ...g0, owner, phase: 'attack', current: 'lula', troops: { ...g0.troops, sp: 30, pr: 20 } };
  let list = [];
  g = attack(g, 'sp', 'pr', seededRng(1));
  list = recordBattle(list, g.lastRoll, 1);
  list = recordBattle(list, g.lastRoll, 1);
  assert.equal(list.length, 1, 'the same roll seen twice (re-render, reconnect) is kept once');
  assert.deepEqual(list[0].attackerDice, g.lastRoll.attackerDice);
  g = blitz(g, 'sp', 'pr', seededRng(2));
  list = recordBattle(list, g.lastRoll, 1);
  assert.equal(list[0].id, g.lastRoll.id, 'newest first');
  assert.ok(list[0].series.rolls >= 2, '"Tudo ou nada" keeps its totals');
  let long = [];
  for (let i = 1; i <= MAX_BATTLES + 30; i++) long = recordBattle(long, { ...g.lastRoll, id: i }, 1);
  assert.equal(long.length, MAX_BATTLES);
  assert.equal(long[0].id, MAX_BATTLES + 30);
  assert.equal(recordBattle(long, null, 1), long);
});
