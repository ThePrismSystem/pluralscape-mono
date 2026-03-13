export interface CleanupResult {
  readonly deletedCount: number;
}

/** Milliseconds in one day. */
export const MS_PER_DAY = 86_400_000;

/**
 * Extracts the deleted_count from a CTE-based DELETE ... RETURNING query result.
 * Handles both postgres-js (RowList array) and pglite (Results { rows }) formats.
 */
export function extractDeletedCount(
  result:
    | ReadonlyArray<{ deleted_count: string }>
    | { rows: ReadonlyArray<{ deleted_count: string }> },
): CleanupResult {
  const rows = "rows" in result ? result.rows : result;
  return { deletedCount: Number(rows[0]?.deleted_count ?? 0) };
}

/** Validates that olderThanDays is a non-negative finite number. */
export function validateOlderThanDays(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`olderThanDays must be a non-negative finite number, got ${String(value)}`);
  }
}

/** Validates that monthsAhead is a non-negative finite number. */
export function validateMonthsAhead(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`monthsAhead must be a non-negative finite number, got ${String(value)}`);
  }
}

/** Validates that olderThanMonths is a positive finite number. */
export function validateOlderThanMonths(value: number): void {
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`olderThanMonths must be >= 1, got ${String(value)}`);
  }
}
