/**
 * Parses a comma-separated string against a fixed set of valid values. Trims
 * whitespace and drops empty entries. Throws a descriptive error naming the
 * flag and listing the valid values if any entry is unrecognized.
 */
export function parseCsvEnum<T extends string>(
  raw: string,
  valid: readonly T[],
  flagName: string,
): T[] {
  const requested = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const validSet = new Set<string>(valid);
  const invalid = requested.filter((s) => !validSet.has(s));
  if (invalid.length > 0) {
    throw new Error(
      `Unknown ${flagName} value(s): ${invalid.join(", ")}. Valid: ${valid.join(", ")}`,
    );
  }
  return requested as T[];
}

/**
 * Parses a comma-separated string of positive integers. Trims whitespace and
 * drops empty entries. Throws a descriptive error naming the flag if any
 * entry is not a positive integer.
 */
export function parseCsvPositiveInts(raw: string, flagName: string): number[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const n = Number(s);
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(
          `Invalid ${flagName} value: "${s}". Expected comma-separated positive integers.`,
        );
      }
      return n;
    });
}
