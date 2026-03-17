export function parsePaginationLimit(
  raw: string | undefined,
  defaultLimit: number,
  maxLimit: number,
): number {
  const parsed = raw ? parseInt(raw, 10) : defaultLimit;
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maxLimit) : defaultLimit;
}
