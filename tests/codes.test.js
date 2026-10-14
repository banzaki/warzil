import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODE_CHARS, CODE_LENGTH, formatCode, normalizeCode, randomCode } from '../worker/codes.js';

test('room codes: 8 unambiguous characters, evenly spread', () => {
  const counts = {};
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const code = randomCode();
    assert.equal(code.length, CODE_LENGTH);
    for (const c of code) {
      assert.ok(CODE_CHARS.includes(c), c);
      counts[c] = (counts[c] ?? 0) + 1;
    }
  }
  const expected = (N * CODE_LENGTH) / CODE_CHARS.length;
  for (const c of CODE_CHARS) assert.ok(Math.abs(counts[c] / expected - 1) < 0.06, `${c}: ${counts[c]}`);
  assert.ok(CODE_CHARS.length ** CODE_LENGTH > 5e11, 'about 39 bits');
});

test('biased bytes are drawn again', () => {
  let call = 0;
  // First batch only has bytes >= 248 (rejected); then all zeros -> 'A'.
  const bytes = (n) => new Uint8Array(n).fill(call++ === 0 ? 250 : 0);
  assert.equal(randomCode(bytes), 'AAAAAAAA');
});

test('typed or pasted codes are normalized; display groups by 4', () => {
  assert.equal(normalizeCode(' abcd-efgh '), 'ABCDEFGH');
  assert.equal(normalizeCode('ab cd ef gh ij'), 'ABCDEFGH');
  assert.equal(normalizeCode(null), '');
  assert.equal(formatCode('ABCDEFGH'), 'ABCD-EFGH');
  assert.equal(formatCode('ABCDE'), 'ABCDE', 'old 5-letter rooms unchanged');
});
