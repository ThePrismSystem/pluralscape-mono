/** Multiplier for one-decimal-place percentage rounding. */
const PERCENT_SCALE = 1000;
const PERCENT_DIVISOR = 10;

/** Round a ratio to one decimal place as a percentage (e.g. 0.333 → 33.3). */
export function toOneDecimalPercent(numerator: number, denominator: number): number {
  return denominator > 0
    ? Math.round((numerator / denominator) * PERCENT_SCALE) / PERCENT_DIVISOR
    : 0;
}
