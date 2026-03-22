import { z } from "zod/v4";

import type { Brand, IdPrefixBrandMap } from "@pluralscape/types";

// ── Branded ID helpers ──────────────────────────────────────────

/** UUID pattern (lowercase hex, 8-4-4-4-12, any version). */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Creates a Zod schema for an optional branded ID body parameter.
 * Validates that the value starts with the expected prefix followed by a valid UUID.
 */
export function optionalBrandedId<P extends keyof IdPrefixBrandMap>(
  prefix: P,
): z.ZodType<Brand<string, IdPrefixBrandMap[P]> | undefined> {
  return z
    .custom<Brand<string, IdPrefixBrandMap[P]>>((val) => {
      if (typeof val !== "string") return false;
      return val.startsWith(prefix) && UUID_REGEX.test(val.slice(prefix.length));
    }, `Expected a valid ${prefix}<uuid> identifier`)
    .optional();
}

/**
 * Creates a Zod schema for a branded ID query parameter.
 * Validates that the value starts with the expected prefix followed by a valid UUID.
 * Chain `.optional()` at the call site if the parameter is optional.
 */
export function brandedIdQueryParam<P extends keyof IdPrefixBrandMap>(
  prefix: P,
): z.ZodType<Brand<string, IdPrefixBrandMap[P]>> {
  return z.custom<Brand<string, IdPrefixBrandMap[P]>>((val) => {
    if (typeof val !== "string") return false;
    return val.startsWith(prefix) && UUID_REGEX.test(val.slice(prefix.length));
  }, `Expected a valid ${prefix}<uuid> identifier`);
}

// ── Subject constraint ──────────────────────────────────────────

/**
 * Refine predicate: at least one polymorphic subject ID must be provided.
 * Used by fronting session and comment create schemas.
 */
export const requireSubject = (data: {
  memberId?: unknown;
  customFrontId?: unknown;
  structureEntityId?: unknown;
}): boolean => Boolean(data.memberId ?? data.customFrontId ?? data.structureEntityId);

/** Error message for the requireSubject refine. */
export const REQUIRE_SUBJECT_MESSAGE =
  "At least one of memberId, customFrontId, or structureEntityId is required";
