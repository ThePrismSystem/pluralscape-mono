import { z } from "zod/v4";

import type { LIFECYCLE_EVENT_TYPES } from "./lifecycle-event.js";
import type { Brand } from "@pluralscape/types";

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
 * Creates a Zod schema for an optional branded ID query parameter.
 * Validates that the value starts with the expected prefix followed by a valid UUID.
 * Uses z.custom to produce the correct branded output type (same approach as brandedString).
 */
function brandedIdQueryParam<B extends string>(
  prefix: string,
): z.ZodType<Brand<string, B> | undefined> {
  return z.custom<Brand<string, B> | undefined>((val) => {
    if (val === undefined || val === null) return true;
    if (typeof val !== "string") return false;
    return val.startsWith(prefix) && UUID_REGEX.test(val.slice(prefix.length));
  });
}

// ── Lifecycle event query schema ────────────────────────────────

/**
 * Query parameters for the lifecycle events list endpoint.
 * Validates eventType against the known lifecycle event type enum.
 */
export const LifecycleEventQuerySchema = z.object({
  eventType: z
    .enum([
      "split",
      "fusion",
      "merge",
      "unmerge",
      "dormancy-start",
      "dormancy-end",
      "discovery",
      "archival",
      "subsystem-formation",
      "form-change",
      "name-change",
      "structure-move",
      "innerworld-move",
    ] satisfies readonly (typeof LIFECYCLE_EVENT_TYPES)[number][])
    .optional(),
});

// ── Relationship query schema ───────────────────────────────────

/**
 * Query parameters for the relationships list endpoint.
 * Validates memberId with branded ID prefix check.
 */
export const RelationshipQuerySchema = z.object({
  memberId: brandedIdQueryParam<"MemberId">("mem_"),
});

// ── Inner world entity query schema ─────────────────────────────

/**
 * Query parameters for the inner world entities list endpoint.
 * Validates regionId with branded ID prefix check and includeArchived boolean.
 */
export const InnerWorldEntityQuerySchema = z.object({
  regionId: brandedIdQueryParam<"InnerWorldRegionId">("iwr_"),
  includeArchived: booleanQueryParam,
});

// ── Structure link query schema ─────────────────────────────────

/**
 * Query parameters for structure link list endpoints.
 * Validates subsystemId, layerId, and sideSystemId with branded ID prefix checks.
 */
export const StructureLinkQuerySchema = z.object({
  subsystemId: brandedIdQueryParam<"SubsystemId">("sub_"),
  layerId: brandedIdQueryParam<"LayerId">("lyr_"),
  sideSystemId: brandedIdQueryParam<"SideSystemId">("ss_"),
});

// ── Include-archived query schema ───────────────────────────────

/**
 * Query parameter schema for endpoints that only need includeArchived validation.
 */
export const IncludeArchivedQuerySchema = z.object({
  includeArchived: booleanQueryParam,
});
