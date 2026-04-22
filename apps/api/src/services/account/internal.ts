export class ConcurrencyError extends Error {
  override readonly name = "ConcurrencyError" as const;
}
