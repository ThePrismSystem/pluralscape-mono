// ── Errors ───────────────────────────────────────────────────────

export class NoActiveRecoveryKeyError extends Error {
  override readonly name = "NoActiveRecoveryKeyError" as const;
}
