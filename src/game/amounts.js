// Quick-pick amounts for occupation and movement: up to 5 consecutive legal
// values starting at the minimum, plus "Máx" when the maximum is not among them.
// A slider covers the values in between when the range is larger.
export const QUICK_COUNT = 5;

export function quickAmounts(min, max) {
  if (max < min) return { values: [], showMax: false, slider: false };
  const values = [];
  for (let n = min; n <= max && values.length < QUICK_COUNT; n++) values.push(n);
  const showMax = !values.includes(max);
  return { values, showMax, slider: max - values[values.length - 1] > 1 };
}

export const clampAmount = (value, min, max) => Math.max(min, Math.min(max, value));
