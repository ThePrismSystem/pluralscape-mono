/**
 * Narrow an unknown value into `Record<string, unknown>` for key iteration.
 *
 * Throws if the input is not a non-null object. Used at validation boundaries
 * (Zod parse results, streaming JSON parse results) where the payload is
 * runtime-known to be an object but the static type is `unknown`.
 *
 * Centralising the widening here means business logic never needs an inline
 * cast — and the runtime guard turns future contract mismatches into visible
 * errors rather than silent type-assertion violations.
 */
export function toRecord(v: unknown): Record<string, unknown> {
  if (v === null || typeof v !== "object") {
    throw new Error(`toRecord expected a non-null object, got ${v === null ? "null" : typeof v}`);
  }
  return v as Record<string, unknown>;
}
