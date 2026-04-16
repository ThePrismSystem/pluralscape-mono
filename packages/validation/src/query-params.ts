import { z } from "zod/v4";

import { brandedIdQueryParam } from "./branded-id.js";
import { LIFECYCLE_EVENT_TYPES } from "./lifecycle-event.js";
import { RELATIONSHIP_TYPES } from "./relationship.js";

// ── Boolean query param ─────────────────────────────────────────

/**
 * Coerces a query-string boolean: "true" → true, "false" / undefined → false.
 * Rejects any other value.
 */
export const booleanQueryParam = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

/**
 * Like {@link booleanQueryParam}, but preserves `undefined` when the parameter
 * is omitted. Use when the caller needs to distinguish "not provided" from "false".
 */
export const optionalBooleanQueryParam = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

// ── Lifecycle event query schema ────────────────────────────────

/**
 * Query parameters for the lifecycle events list endpoint.
 * Validates eventType against the known lifecycle event type enum.
 */
export const LifecycleEventQuerySchema = z.object({
  eventType: z.enum(LIFECYCLE_EVENT_TYPES).optional(),
  includeArchived: booleanQueryParam,
});

// ── Relationship query schema ───────────────────────────────────

/**
 * Query parameters for the relationships list endpoint.
 * Validates memberId with branded ID prefix check and optional type filter.
 */
export const RelationshipQuerySchema = z.object({
  memberId: brandedIdQueryParam("mem_").optional(),
  type: z.enum(RELATIONSHIP_TYPES).optional(),
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

// ── Structure entity query schemas ──────────────────────────────

/**
 * Query parameters for the structure entity link list endpoint.
 * Filters by either source or target structure entity ID.
 */
export const StructureEntityLinkQuerySchema = z.object({
  sourceEntityId: brandedIdQueryParam("ste_").optional(),
  targetEntityId: brandedIdQueryParam("ste_").optional(),
});

/**
 * Query parameters for the structure entity member link list endpoint.
 * Filters by structure entity ID or member ID.
 */
export const StructureEntityMemberLinkQuerySchema = z.object({
  structureEntityId: brandedIdQueryParam("ste_").optional(),
  memberId: brandedIdQueryParam("mem_").optional(),
});

/**
 * Query parameters for the structure entity association list endpoint.
 * Filters by either source or target structure entity ID.
 */
export const StructureEntityAssociationQuerySchema = z.object({
  sourceEntityId: brandedIdQueryParam("ste_").optional(),
  targetEntityId: brandedIdQueryParam("ste_").optional(),
});

// ── Include-archived query schema ───────────────────────────────

/**
 * Query parameter schema for endpoints that only need includeArchived validation.
 */
export const IncludeArchivedQuerySchema = z.object({
  includeArchived: booleanQueryParam,
});
