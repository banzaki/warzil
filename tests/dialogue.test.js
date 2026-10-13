import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACTIONS, REGIONS, STATE_IDS } from '../src/game/data.js';
import { LINES, NEWS, createLinePicker, defeatLine, describeEvent, eliminatorLine, fill, loseLine } from '../src/game/texts.js';
import { attack, blitz, createGame, occupy } from '../src/game/engine.js';
import { seededRng } from '../src/game/daily.js';

const IDS = Object.keys(FACTIONS);
const LIST_KEYS = ['start', 'turn', 'conquer', 'lose', 'bigLoss', 'regionGained', 'regionLost', 'eliminates', 'eliminated', 'victory', 'knockout', 'defeat', 'streak', 'lastStand', 'underdog', 'longVictory'];
const TOKENS = /\{(state|o_state|O_state|de_state|em_state|region|rival)\}/g;
const allLines = (l) => [...LIST_KEYS.flatMap((k) => l[k]), ...Object.values(l.conquerSpecial).flat(), ...Object.values(l.regionGainedSpecial)];

test('every candidate has every category, with the same number of lines', () => {
  for (const key of LIST_KEYS) {
    const counts = IDS.map((id) => LINES[id][key]?.length ?? 0);
    assert.ok(counts[0] > 0, `${key} empty`);
    assert.deepEqual(new Set(counts).size, 1, `${key} unbalanced: ${IDS.map((id, i) => `${id}=${counts[i]}`).join(' ')}`);
  }
  const special = IDS.map((id) => Object.values(LINES[id].conquerSpecial).flat().length);
  assert.equal(new Set(special).size, 1, `conquerSpecial unbalanced: ${special}`);
  for (const id of IDS) {
    for (const s of Object.keys(LINES[id].conquerSpecial)) assert.ok(STATE_IDS.includes(s), `${id}: unknown state ${s}`);
    assert.ok(LINES[id].card.title && LINES[id].card.pitch);
  }
});

test('only known placeholders, and every line renders for every state, region and rival', () => {
  for (const id of IDS) {
    const lines = [...allLines(LINES[id]), ...NEWS];
    for (const line of lines) {
      const unknown = line.replace(TOKENS, '').match(/\{[^}]*\}/);
      assert.equal(unknown, null, `${id}: unknown placeholder in "${line}"`);
      for (const state of STATE_IDS) {
        for (const region of Object.keys(REGIONS)) {
          const out = fill(line, { state, region, rival: IDS.find((r) => r !== id) });
          assert.ok(!out.includes('{'), `${id}: "${out}"`);
        }
      }
    }
  }
});

test('Portuguese articles and contractions', () => {
  assert.equal(fill('{o_state}|{O_state}|{de_state}|{em_state}', { state: 'ba' }), 'a Bahia|A Bahia|da Bahia|na Bahia');
  assert.equal(fill('{o_state}|{O_state}|{de_state}|{em_state}', { state: 'sp' }), 'São Paulo|São Paulo|de São Paulo|em São Paulo');
  assert.equal(fill('{o_state}|{O_state}|{de_state}|{em_state}', { state: 'rj' }), 'o Rio de Janeiro|O Rio de Janeiro|do Rio de Janeiro|no Rio de Janeiro');
  assert.equal(fill('Perdi {o_state}?', { state: 'ce' }), 'Perdi o Ceará?');
  assert.equal(fill('o {region} e o {rival}', { region: 'northeast', rival: 'cury' }), 'o Nordeste e o Cury');
});

test('the picker avoids recent repeats and stays stable per event', () => {
  const choose = createLinePicker();
  const pool = LINES.lula.conquer; // 12 lines
  const seen = [];
  for (let i = 0; i < 60; i++) {
    const line = choose(`k${i}`, pool, (i * 0.618) % 1);
    const window = seen.slice(-(pool.length - 1));
    assert.ok(!window.includes(line), `repeat after ${window.length} picks: ${line}`);
    seen.push(line);
  }
  // Same event key -> same text, even after other picks.
  const first = choose('fixed', LINES.renan.turn, 0.3);
  choose('other', LINES.renan.turn, 0.3);
  assert.equal(choose('fixed', LINES.renan.turn, 0.9), first);
});

test('every event type produces a line for every candidate', () => {
  for (const faction of IDS) {
    const rival = IDS.find((r) => r !== faction);
    const events = [
      { type: 'start' }, { type: 'turn' }, { type: 'victory' }, { type: 'knockout', loser: rival },
      { type: 'conquer', state: 'go', loser: rival }, { type: 'conquer', state: 'df', loser: rival, seed: 0.05 },
      { type: 'region', region: 'south' }, { type: 'regionLost', region: 'north', by: rival },
      { type: 'bigLoss', state: 'sp' }, { type: 'eliminated', loser: rival },
    ];
    events.forEach((e, i) => {
      const r = describeEvent({ id: i, seed: 0.42, faction, ...e });
      assert.ok(r.text && !r.text.includes('{'), `${faction} ${e.type}: "${r.text}"`);
    });
    assert.ok(loseLine({ id: 1, seed: 0.5, loser: faction, state: 'ba' }).includes('Bahia'));
    assert.ok(eliminatorLine({ id: 2, seed: 0.5, faction, loser: rival }).length > 5);
    assert.ok(defeatLine(faction, 0.7).length > 5);
  }
});

// A hand-built board for engine event checks.
function board(owner, troops, current = 'lula') {
  const g = createGame('lula', seededRng(5), ['flavio', 'cury']);
  return { ...g, owner, troops: { ...Object.fromEntries(STATE_IDS.map((id) => [id, 1])), ...troops }, phase: 'attack', current, reinforcements: 0 };
}
const scripted = (...faces) => {
  let i = 0;
  return () => (faces[i++ % faces.length] - 1) / 6 + 0.01;
};

test('engine reports regions changing hands and big losses', () => {
  // Flávio holds the whole South; Lula takes Paraná from São Paulo.
  const owner = Object.fromEntries(STATE_IDS.map((id) => [id, 'cury']));
  Object.assign(owner, { pr: 'flavio', sc: 'flavio', rs: 'flavio', sp: 'lula' });
  let g = board(owner, { sp: 10, pr: 1 });
  g = blitz(g, 'sp', 'pr', scripted(6, 1));
  const types = g.log.slice(0, 3).map((e) => e.type);
  assert.ok(types.includes('regionLost'), types.join(','));
  assert.equal(g.log.find((e) => e.type === 'regionLost').faction, 'flavio');

  // Lula completes the South by taking the last state.
  const owner2 = { ...owner, pr: 'lula', sc: 'lula', rs: 'flavio' };
  let h = board(owner2, { sc: 10, rs: 1 });
  h = blitz(h, 'sc', 'rs', scripted(6, 1));
  const gained = h.log.find((e) => e.type === 'region');
  assert.ok(gained && gained.faction === 'lula' && gained.region === 'south');

  // Three armies lost in one roll -> bigLoss.
  const k = attack(board(owner, { sp: 10, pr: 10 }), 'sp', 'pr', scripted(1));
  assert.equal(k.log[0].type, 'bigLoss');
  assert.equal(k.lastRoll.attackerLoss, 3);
});

test('interleaved picks from other lists do not cause early repeats', () => {
  const choose = createLinePicker();
  const pool = LINES.caiado.turn;
  const seen = [];
  for (let i = 0; i < 40; i++) {
    choose(`noise-a${i}`, LINES.lula.conquer, (i * 0.37) % 1);
    choose(`noise-b${i}`, NEWS, (i * 0.11) % 1);
    const line = choose(`t${i}`, pool, (i * 0.618) % 1);
    assert.ok(!seen.slice(-(pool.length - 1)).includes(line), `early repeat: ${line}`);
    seen.push(line);
  }
});

test('every candidate has one special line for each region', () => {
  for (const id of IDS) {
    assert.deepEqual(Object.keys(LINES[id].regionGainedSpecial).sort(), Object.keys(REGIONS).sort(), id);
  }
});

test('new context events produce lines; long wars use their own victory lines', () => {
  for (const faction of IDS) {
    for (const type of ['streak', 'lastStand', 'underdog']) {
      const r = describeEvent({ id: 1, seed: 0.3, faction, type, count: 3, state: 'ba' });
      assert.ok(LINES[faction][type].includes(r.text), `${faction} ${type}`);
    }
    const long = describeEvent({ id: 2, seed: 0.3, faction, type: 'victory', round: 18 });
    assert.ok(LINES[faction].longVictory.includes(long.text));
    const short = describeEvent({ id: 3, seed: 0.3, faction, type: 'victory', round: 8 });
    assert.ok(LINES[faction].victory.includes(short.text));
  }
});

test('engine reports streaks, last stands and comebacks', () => {
  // Streak: Lula takes three states in one battle turn.
  const owner = Object.fromEntries(STATE_IDS.map((id) => [id, 'cury']));
  Object.assign(owner, { sp: 'lula', pr: 'flavio', sc: 'flavio', rs: 'flavio', mg: 'flavio' });
  let g = { ...board(owner, { sp: 30, pr: 1, sc: 1, rs: 1, mg: 1 }), turnConquests: 0, round: 2 };
  g = occupy(blitz(g, 'sp', 'pr', scripted(6, 1)), 99);
  g = occupy(blitz(g, 'pr', 'sc', scripted(6, 1)), 99);
  g = blitz(g, 'sc', 'rs', scripted(6, 1));
  assert.ok(g.log.some((e) => e.type === 'streak' && e.faction === 'lula' && e.count === 3));
  // Last stand: Flávio's only state survives a roll, logged once per turn.
  const owner2 = { ...owner, pr: 'lula', sc: 'lula', rs: 'lula', mg: 'flavio' };
  let h = { ...board(owner2, { sp: 10, mg: 5 }), lastStandLogged: [] };
  h = attack(h, 'sp', 'mg', scripted(1));
  assert.equal(h.log[0].type, 'lastStand');
  assert.equal(h.log[0].faction, 'flavio');
  assert.equal(attack(h, 'sp', 'mg', scripted(1)).log.filter((e) => e.type === 'lastStand').length, 1);
  // Comeback: a faction with 3 states or fewer conquers in round 2+.
  const owner3 = Object.fromEntries(STATE_IDS.map((id) => [id, 'flavio']));
  Object.assign(owner3, { sp: 'lula', mg: 'lula' });
  let k = { ...board(owner3, { sp: 10, pr: 1 }), round: 3, factions: ['lula', 'flavio'] };
  k = blitz(k, 'sp', 'pr', scripted(6, 1));
  assert.ok(k.log.some((e) => e.type === 'underdog' && e.faction === 'lula'));
});
