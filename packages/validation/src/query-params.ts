import { z } from "zod/v4";

import { LIFECYCLE_EVENT_TYPES } from "./lifecycle-event.js";

import type { Brand, IdPrefixBrandMap } from "@pluralscape/types";

// ── Boolean query param ─────────────────────────────────────────

/**
 * Coerces a query-string boolean: "true" → true, "false" / undefined → false.
 * Rejects any other value.
 */
export const booleanQueryParam = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

// ── Branded ID query params ─────────────────────────────────────

/** UUID pattern (lowercase hex, 8-4-4-4-12, any version). */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Creates a Zod schema for a branded ID query parameter.
 * Validates that the value starts with the expected prefix followed by a valid UUID.
 * Uses z.custom to produce the correct branded output type (same approach as brandedString).
 * Chain `.optional()` at the call site if the parameter is optional.
 */
function brandedIdQueryParam<P extends keyof IdPrefixBrandMap>(
  prefix: P,
): z.ZodType<Brand<string, IdPrefixBrandMap[P]>> {
  return z.custom<Brand<string, IdPrefixBrandMap[P]>>((val) => {
    if (typeof val !== "string") return false;
    return val.startsWith(prefix) && UUID_REGEX.test(val.slice(prefix.length));
  }, `Expected a valid ${prefix}<uuid> identifier`);
}

// ── Lifecycle event query schema ────────────────────────────────

/**
 * Query parameters for the lifecycle events list endpoint.
 * Validates eventType against the known lifecycle event type enum.
 */
export const LifecycleEventQuerySchema = z.object({
  eventType: z.enum(LIFECYCLE_EVENT_TYPES).optional(),
});

// ── Relationship query schema ───────────────────────────────────

/**
 * Query parameters for the relationships list endpoint.
 * Validates memberId with branded ID prefix check.
 */
export const RelationshipQuerySchema = z.object({
  memberId: brandedIdQueryParam("mem_").optional(),
});

// ── Inner world entity query schema ─────────────────────────────

/**
 * Query parameters for the inner world entities list endpoint.
 * Validates regionId with branded ID prefix check and includeArchived boolean.
 */
export const InnerWorldEntityQuerySchema = z.object({
  regionId: brandedIdQueryParam("iwr_").optional(),
  includeArchived: booleanQueryParam,
});

// ── Structure link query schemas ────────────────────────────────

/**
 * Query parameters for the subsystem ↔ layer link list endpoint.
 */
export const SubsystemLayerQuerySchema = z.object({
  subsystemId: brandedIdQueryParam("sub_").optional(),
  layerId: brandedIdQueryParam("lyr_").optional(),
});

/**
 * Query parameters for the subsystem ↔ side system link list endpoint.
 */
export const SubsystemSideSystemQuerySchema = z.object({
  subsystemId: brandedIdQueryParam("sub_").optional(),
  sideSystemId: brandedIdQueryParam("ss_").optional(),
});

/**
 * Query parameters for the side system ↔ layer link list endpoint.
 */
export const SideSystemLayerQuerySchema = z.object({
  sideSystemId: brandedIdQueryParam("ss_").optional(),
  layerId: brandedIdQueryParam("lyr_").optional(),
});

// ── Include-archived query schema ───────────────────────────────

/**
 * Query parameter schema for endpoints that only need includeArchived validation.
 */
export const IncludeArchivedQuerySchema = z.object({
  includeArchived: booleanQueryParam,
});
