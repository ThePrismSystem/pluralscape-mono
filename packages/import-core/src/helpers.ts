import type { HexColor } from "@pluralscape/types";

/**
 * Maximum number of unresolved foreign-key source IDs rendered inline in a
 * mapper error message by {@link summarizeMissingRefs}. Larger lists are
 * summarized with an "and N more" suffix; the full list still travels with
 * the error's structured `missingRefs` field.
 */
const MISSING_REFS_PREVIEW_LIMIT = 5;

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

/**
 * Render a bounded preview of unresolved-reference source IDs for inclusion
 * in a mapper error message. Keeps server logs short even when an entity has
 * hundreds of missing refs, while the full list remains on the error's
 * `missingRefs` structured field for downstream processing.
 */
export function summarizeMissingRefs(refs: readonly string[]): string {
  if (refs.length <= MISSING_REFS_PREVIEW_LIMIT) return refs.join(", ");
  const shown = refs.slice(0, MISSING_REFS_PREVIEW_LIMIT).join(", ");
  const remaining = refs.length - MISSING_REFS_PREVIEW_LIMIT;
  return `${shown}, and ${String(remaining)} more`;
}

/** Hex color regex: #RGB, #RRGGBB, or #RRGGBBAA */
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Parse a color string into a validated HexColor, or null if invalid.
 * Some sources do not validate color format, so arbitrary strings may appear.
 */
export function parseHexColor(value: string | undefined | null): HexColor | null {
  if (value === null || value === undefined || value === "") return null;
  if (HEX_COLOR_REGEX.test(value)) return value as HexColor;
  return null;
}
