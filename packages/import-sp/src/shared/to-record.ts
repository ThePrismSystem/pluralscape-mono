/**
 * Narrow a value already verified as a non-null object into
 * `Record<string, unknown>` for key iteration.
 *
 * Callers must have verified `typeof v === "object" && v !== null` before
 * calling — this helper centralises the unavoidable widening cast so it
 * does not appear inline in business logic. Used at validation boundaries
 * (Zod parse results, streaming JSON parse results) where the payload is
 * known-object but the structural type is `object`.
 */
export function toRecord(v: object): Record<string, unknown> {
  return v as Record<string, unknown>;
}
