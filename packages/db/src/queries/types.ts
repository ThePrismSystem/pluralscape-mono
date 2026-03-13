export interface CleanupResult {
  readonly deletedCount: number;
}

/** Milliseconds in one day. */
export const MS_PER_DAY = 86_400_000;

/** Validates that olderThanDays is a non-negative finite number. */
export function validateOlderThanDays(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`olderThanDays must be a non-negative finite number, got ${String(value)}`);
  }
}
