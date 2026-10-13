import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampAmount, quickAmounts } from '../src/game/amounts.js';

test('quick amounts: only legal values, max button when needed', () => {
  assert.deepEqual(quickAmounts(1, 1), { values: [1], showMax: false, slider: false });
  assert.deepEqual(quickAmounts(1, 4), { values: [1, 2, 3, 4], showMax: false, slider: false });
  assert.deepEqual(quickAmounts(1, 6), { values: [1, 2, 3, 4, 5], showMax: true, slider: false });
  assert.deepEqual(quickAmounts(1, 20), { values: [1, 2, 3, 4, 5], showMax: true, slider: true });
  // Occupation: minimum is the number of dice in the final roll.
  assert.deepEqual(quickAmounts(3, 9), { values: [3, 4, 5, 6, 7], showMax: true, slider: true });
  assert.deepEqual(quickAmounts(2, 3), { values: [2, 3], showMax: false, slider: false });
  // Nothing legal.
  assert.deepEqual(quickAmounts(1, 0), { values: [], showMax: false, slider: false });
});

test('every offered value is within the rules', () => {
  for (let min = 1; min <= 3; min++) {
    for (let max = min; max <= 40; max++) {
      const { values, showMax } = quickAmounts(min, max);
      for (const v of values) assert.ok(v >= min && v <= max);
      assert.ok(values.includes(max) || showMax, `max ${max} reachable`);
      assert.equal(clampAmount(max + 5, min, max), max);
      assert.equal(clampAmount(min - 5, min, max), min);
    }
  }
});
