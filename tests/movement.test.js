// v0.8 movement rules, checked army by army: a state may split its armies over
// several transfers, every army moves at most once per movement phase, received
// armies stay put, and 1 army always stays home. Also through the online server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADJACENCY, STATE_IDS } from '../src/game/data.js';
import { attack, canFortify, createGame, endAttack, endTurn, fortify, movableTroops, occupy } from '../src/game/engine.js';
import { aiStep } from '../src/game/ai.js';
import { seededRng } from '../src/game/daily.js';
import { createRoom, joinRoom, pickFaction, playerAction, publicView, setConnected, startGame } from '../worker/room.js';

const T0 = 1_700_000_000_000;
// Rigged dice for one exchange: the attacker's 3 dice roll 6, the defender's 1 rolls 1.
const attackerWins = () => {
  let i = 0;
  return () => (i++ < 3 ? 0.99 : 0);
};

// Lula owns everything except the listed Flávio states; 1 army everywhere unless given.
function board({ flavio = [], troops = {}, phase = 'fortify' } = {}) {
  const g = createGame('lula', seededRng(1), undefined, { fixedOrder: true });
  const owner = Object.fromEntries(STATE_IDS.map((id) => [id, flavio.includes(id) ? 'flavio' : 'lula']));
  const t = Object.fromEntries(STATE_IDS.map((id) => [id, 1]));
  return { ...g, owner, troops: { ...t, ...troops }, phase, current: 'lula', reinforcements: 0, movedOut: {}, received: {}, selected: null, target: null };
}

test("the Product Owner's example: 10 armies, 5 to one neighbour and 4 to another, 1 stays", () => {
  // RS only borders SC on this map, so the same split from São Paulo.
  let g = board({ flavio: ['rs'], troops: { sp: 10 } });
  g = fortify(g, 'sp', 'mg', 5);
  g = fortify(g, 'sp', 'pr', 4);
  assert.deepEqual([g.troops.sp, g.troops.mg, g.troops.pr], [1, 6, 5]);
  assert.equal(canFortify(g, 'sp', 'rj'), false, 'the last army defends SP');
  // Three or more transfers are fine too while own armies remain.
  let h = board({ flavio: ['rs'], troops: { sp: 10 } });
  for (const to of ['mg', 'rj', 'pr', 'ms']) h = fortify(h, 'sp', to, 2);
  assert.equal(h.troops.sp, 2);
  assert.equal(movableTroops(h, 'sp'), 1);
});

test('armies received this phase never move again; the receiver may still send its own', () => {
  // The reported chain RS -> SC -> PR -> SP with one big stack is impossible.
  let g = board({ flavio: ['ba'], troops: { rs: 10, sc: 1, pr: 1, sp: 1 } });
  g = fortify(g, 'rs', 'sc', 9);
  assert.equal(movableTroops(g, 'sc'), 1, 'only SC’s own army');
  assert.equal(fortify(g, 'sc', 'pr', 9), g, 'the 9 that arrived cannot go on');
  assert.equal(fortify(g, 'sc', 'pr', 2), g);
  g = fortify(g, 'sc', 'pr', 1);
  assert.equal(g.troops.sc, 9, 'the 9 received stay in SC');
  assert.equal(movableTroops(g, 'pr'), 1);
  assert.equal(fortify(g, 'pr', 'sp', 2), g);
});

test('states with a single army cannot send, unless armies arrived to stay in their place', () => {
  let g = board({ flavio: ['rs'], troops: { mg: 1, sp: 4 } });
  assert.equal(movableTroops(g, 'mg'), 0);
  assert.equal(fortify(g, 'mg', 'go', 1), g);
  g = fortify(g, 'sp', 'mg', 3);
  assert.equal(movableTroops(g, 'mg'), 1, 'its own army may leave; a received one defends');
});

// Every army is a token with a "moved" flag. After each accepted transfer there
// must be enough unmoved tokens of the origin to send, with 1 token left behind.
test('army-by-army audit: random transfers never move an army twice, create or lose armies', () => {
  for (let seed = 1; seed <= 400; seed++) {
    const rng = seededRng(seed);
    const troops = Object.fromEntries(STATE_IDS.map((id) => [id, 1 + Math.floor(rng() * 7)]));
    let g = board({ flavio: ['rs', 'ap', 'to'], troops });
    const tokens = Object.fromEntries(STATE_IDS.map((id) => [id, Array.from({ length: g.troops[id] }, () => ({ moved: false }))]));
    let accepted = 0;
    for (let i = 0; i < 80; i++) {
      const from = STATE_IDS[Math.floor(rng() * 27)];
      const to = ADJACENCY[from][Math.floor(rng() * ADJACENCY[from].length)];
      const amount = 1 + Math.floor(rng() * 6);
      const next = fortify(g, from, to, amount);
      if (next === g) continue;
      accepted++;
      const unmoved = tokens[from].filter((t) => !t.moved);
      assert.ok(unmoved.length >= amount, `seed ${seed}: ${from} sent ${amount} but had ${unmoved.length} unmoved`);
      assert.ok(tokens[from].length - amount >= 1, `seed ${seed}: ${from} emptied`);
      for (let k = 0; k < amount; k++) {
        const t = unmoved[k];
        tokens[from].splice(tokens[from].indexOf(t), 1);
        tokens[to].push({ moved: true });
      }
      g = next;
      for (const id of STATE_IDS) assert.equal(g.troops[id], tokens[id].length, `seed ${seed}: ${id} count`);
    }
    assert.ok(accepted > 0);
  }
});

test('occupying a conquest is part of the battle; movement rules start fresh afterwards', () => {
  // SP (10) conquers PR (1) with a rigged roll, moves everything it can in.
  let g = board({ flavio: ['pr', 'rs'], troops: { sp: 10, pr: 1 }, phase: 'attack' });
  g = attack(g, 'sp', 'pr', attackerWins());
  assert.equal(g.owner.pr, 'lula');
  g = occupy(g, g.pendingOccupy.max);
  assert.deepEqual(g.received, {}, 'occupation is not a movement transfer');
  assert.deepEqual(g.movedOut, {});
  g = endAttack(g);
  // PR's armies are now its own: they may make their single movement step.
  assert.equal(movableTroops(g, 'pr'), g.troops.pr - 1);
  const pr = g.troops.pr;
  g = fortify(g, 'pr', 'sc', 2);
  assert.equal(g.troops.pr, pr - 2);
  assert.equal(fortify(g, 'sc', 'rs', 1), g, 'never into an enemy state');
});

test('after eliminating a rival, movement works the same and limits reset next turn', () => {
  let g = board({ flavio: ['rs'], troops: { sc: 8, rs: 1 }, phase: 'attack' });
  g = { ...g, factions: ['lula', 'flavio', 'cury'], owner: { ...g.owner, ap: 'cury' }, human: null };
  g = attack(g, 'sc', 'rs', attackerWins());
  assert.ok(g.eliminated.includes('flavio'));
  if (g.phase === 'occupy') g = occupy(g, g.pendingOccupy.min);
  g = endAttack(g);
  g = fortify(g, 'sc', 'pr', 2);
  g = fortify(g, 'sc', 'rs', 1);
  assert.equal(g.movedOut.sc, 3);
  g = endTurn(g, seededRng(3));
  assert.equal(g.current, 'cury', 'the eliminated faction is skipped');
  assert.deepEqual(g.movedOut, {});
  assert.deepEqual(g.received, {});
});

test('saved games from before v0.8 (movedOut: true) keep working', () => {
  let g = { ...board({ flavio: ['rs'], troops: { sp: 6 } }), movedOut: { sp: true } };
  g = fortify(g, 'sp', 'mg', 2);
  assert.equal(g.movedOut.sp, 3);
  assert.equal(g.troops.sp, 4);
});

test('the AI keeps one outgoing move per state and obeys the same limits', () => {
  let g = board({ flavio: ['rs', 'sc', 'pr'], troops: { sp: 10, ms: 5, mg: 7, rs: 1, sc: 1, pr: 1 } });
  const rng = seededRng(5);
  const sent = new Set();
  for (let i = 0; i < 100 && g.current === 'lula' && g.phase === 'fortify'; i++) {
    const prev = g;
    g = aiStep(g, rng);
    if (g.phase !== 'fortify' || g.current !== 'lula') break;
    const from = STATE_IDS.find((id) => g.movedOut[id] !== prev.movedOut[id]);
    assert.ok(from && !sent.has(from), 'one move per state');
    sent.add(from);
    for (const id of STATE_IDS) assert.ok(g.troops[id] >= 1);
  }
});

// ---------- Online: the server applies the same rules to every message ----------

function onlineFortify() {
  let { room } = createRoom({ code: 'ABCDEFGH', nick: 'Ana', token: 't0', playerId: 'p0', now: T0 });
  room = joinRoom(room, { nick: 'Beto', token: 't1', playerId: 'p1', now: T0 }).room;
  room = pickFaction(room, 'p0', 'lula', T0).room;
  room = pickFaction(room, 'p1', 'flavio', T0).room;
  room = startGame(room, 'p0', seededRng(10), T0).room;
  const me = room.game.current;
  const rival = room.game.factions.find((f) => f !== me);
  const owner = Object.fromEntries(STATE_IDS.map((id) => [id, me]));
  owner.rs = rival;
  owner.ap = rival;
  const troops = { ...Object.fromEntries(STATE_IDS.map((id) => [id, 1])), sp: 10 };
  room = { ...room, game: { ...room.game, owner, troops, phase: 'fortify', movedOut: {}, received: {} } };
  return { room, pid: room.controllers[me], other: room.controllers[rival] };
}

test('online: several transfers from one state are accepted, every illegal command is refused', () => {
  let { room, pid, other } = onlineFortify();
  let seq = 0;
  const send = (r, who, action) => playerAction(r, who, action, ++seq, seededRng(1), T0);
  room = send(room, pid, { kind: 'fortify', from: 'sp', to: 'mg', amount: 5 }).room;
  room = send(room, pid, { kind: 'fortify', from: 'sp', to: 'pr', amount: 4 }).room;
  assert.deepEqual([room.game.troops.sp, room.game.troops.mg, room.game.troops.pr], [1, 6, 5]);
  const refused = [
    [pid, { kind: 'fortify', from: 'sp', to: 'rj', amount: 1 }], // last army
    [pid, { kind: 'fortify', from: 'mg', to: 'go', amount: 2 }], // received armies
    [pid, { kind: 'fortify', from: 'pr', to: 'rs', amount: 1 }], // enemy state
    [pid, { kind: 'fortify', from: 'sp', to: 'am', amount: 1 }], // teleport
    [pid, { kind: 'fortify', from: 'mg', to: 'go', amount: 999 }],
    [pid, { kind: 'fortify', from: 'mg', to: 'go', amount: -3 }],
    [pid, { kind: 'fortify', from: 'mg', to: 'go', amount: 1.5 }],
    [other, { kind: 'fortify', from: 'mg', to: 'go', amount: 1 }], // not their turn
  ];
  for (const [who, action] of refused) {
    const res = send(room, who, action);
    assert.ok(res.error, `refused: ${JSON.stringify(action)}`);
  }
  // MG's own single army is still allowed to make its one step.
  room = send(room, pid, { kind: 'fortify', from: 'mg', to: 'go', amount: 1 }).room;
  assert.equal(room.game.troops.go, 2);
});

test('online: a reconnecting player sees the same movement limits', () => {
  let { room, pid } = onlineFortify();
  room = playerAction(room, pid, { kind: 'fortify', from: 'sp', to: 'mg', amount: 5 }, 1, seededRng(1), T0).room;
  room = setConnected(room, pid, false, T0 + 1000).room;
  room = setConnected(room, pid, true, T0 + 2000).room;
  const view = publicView(room, pid, T0 + 2000).game;
  assert.equal(movableTroops(view, 'sp'), 4);
  assert.equal(movableTroops(view, 'mg'), 1, 'MG: its own 1 may go, the 5 received stay');
  assert.equal(playerAction(room, pid, { kind: 'fortify', from: 'mg', to: 'go', amount: 2 }, 2, seededRng(1), T0).error, 'illegal');
  assert.equal(playerAction(room, pid, { kind: 'fortify', from: 'sp', to: 'pr', amount: 4 }, 2, seededRng(1), T0).room.game.troops.sp, 1);
});
