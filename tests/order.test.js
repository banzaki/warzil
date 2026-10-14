import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game/engine.js';
import { aiStep } from '../src/game/ai.js';
import { seededRng } from '../src/game/daily.js';
import { createRoom, joinRoom, pickFaction, publicView, rematch, startGame } from '../worker/room.js';

// Regression for the v0.7 bug: the per-round rotation let the last faction of
// a round open the next one, so it battled twice in a row (767 of 900 matches).
test('nobody plays two turns in a row, and the drawn order never changes (2-4 players, with eliminations)', () => {
  let eliminationsSeen = 0;
  for (const rivals of [['flavio'], ['flavio', 'cury'], ['flavio', 'cury', 'renan']]) {
    for (let seed = 1; seed <= 150; seed++) {
      const rng = seededRng(seed);
      let g = createGame('lula', rng, rivals, { spectator: true });
      const order = [...g.factions];
      const turns = [];
      while (g.phase !== 'over') {
        const prev = g;
        g = aiStep(g, rng);
        // A battle turn starts when the phase becomes 'attack' for a new faction.
        if (g.phase === 'attack' && (prev.phase === 'reinforce' || prev.current !== g.current) && prev.phase !== 'occupy') {
          turns.push({ faction: g.current, alive: g.factions.length - g.eliminated.length });
        }
        assert.deepEqual(g.factions, order, 'order fixed');
      }
      eliminationsSeen += g.eliminated.length > 1 ? 1 : 0;
      for (let k = 1; k < turns.length; k++) {
        if (turns[k].alive >= 2) assert.notEqual(turns[k].faction, turns[k - 1].faction, `seed ${seed}: ${turns[k].faction} twice in a row`);
      }
      // Each turn follows the drawn order among survivors.
      for (let k = 1; k < turns.length; k++) {
        const a = order.indexOf(turns[k - 1].faction);
        const b = order.indexOf(turns[k].faction);
        const between = [];
        for (let x = (a + 1) % order.length; x !== b; x = (x + 1) % order.length) between.push(order[x]);
        assert.ok(between.every((f) => g.eliminated.includes(f)), `seed ${seed}: skipped a live faction`);
      }
    }
  }
  assert.ok(eliminationsSeen > 50, 'matches with eliminations were covered');
});

test('online: the server draws the order once; every client receives the same; rematch draws again', () => {
  const T0 = 1_700_000_000_000;
  let { room } = createRoom({ code: 'ABCDEFGH', nick: 'Ana', token: 't0', playerId: 'p0', now: T0 });
  room = joinRoom(room, { nick: 'Beto', token: 't1', playerId: 'p1', now: T0 }).room;
  room = joinRoom(room, { nick: 'Caio', token: 't2', playerId: 'p2', now: T0 }).room;
  ['lula', 'flavio', 'renan'].forEach((f, i) => (room = pickFaction(room, `p${i}`, f, T0).room));
  const orders = new Set();
  const rng = seededRng(3);
  for (let k = 0; k < 40; k++) {
    room = startGame({ ...room, status: 'lobby' }, 'p0', rng, T0).room;
    const views = ['p0', 'p1', 'p2'].map((p) => publicView(room, p).game.factions.join());
    assert.equal(new Set(views).size, 1, 'same order for everybody');
    orders.add(views[0]);
  }
  assert.ok(orders.size >= 5, 'the order is really drawn, not always the lobby order');
  const over = { ...room, status: 'over', game: { ...room.game, phase: 'over' } };
  const again = new Set(Array.from({ length: 20 }, () => rematch(over, 'p0', rng, T0).room.game.factions.join()));
  assert.ok(again.size > 1, 'a rematch draws a new order');
});
