import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIP_ORDER, markSeen, tipFor, tutorialDone } from '../src/game/tutorial.js';

const game = (over) => ({ current: 'lula', phase: 'reinforce', lastRoll: null, ...over });

test('each tip shows up in its own moment, only in the player’s turn', () => {
  assert.equal(tipFor(game(), 'lula', []), 'rally');
  assert.equal(tipFor(game({ current: 'flavio' }), 'lula', []), null, 'never during someone else’s turn');
  assert.equal(tipFor(game({ phase: 'attack' }), 'lula', []), 'attack');
  assert.equal(tipFor(game({ phase: 'attack', lastRoll: { attacker: 'lula' } }), 'lula', []), 'dice', 'right after the first roll');
  assert.equal(tipFor(game({ phase: 'attack', lastRoll: { attacker: 'flavio' } }), 'lula', ['attack']), null);
  assert.equal(tipFor(game({ phase: 'occupy', lastRoll: { attacker: 'lula' } }), 'lula', ['dice']), null);
  assert.equal(tipFor(game({ phase: 'fortify' }), 'lula', []), 'move');
  assert.equal(tipFor(game({ phase: 'over' }), 'lula', []), null);
  assert.equal(tipFor(game(), null, []), null, 'spectators get no tips');
});

test('seen tips never come back; all four seen = done', () => {
  let t = { seen: [], off: false };
  for (const id of TIP_ORDER) {
    assert.equal(tutorialDone(t), false);
    t = markSeen(markSeen(t, id), id);
  }
  assert.equal(t.seen.length, 4);
  assert.equal(tutorialDone(t), true);
  assert.equal(tipFor(game(), 'lula', t.seen), null);
  assert.equal(tutorialDone({ seen: [], off: true }), true, '"Pular dicas" ends it at once');
});
