/**
 * Per-JobType payload schemas for boundary validation.
 *
 * Used by both the BullMQ adapter (StoredJobDataSchema.superRefine) and the
 * SQLite adapter (rowToJob) so a mismatched `(type, payload)` pair at either
 * boundary raises {@link QueueCorruptionError} rather than propagating a
 * silently-malformed JobDefinition.
 *
 * Single source of truth — avoid duplicating these schemas in new adapters.
 * The `PayloadSchemaConformance` satisfies check below keeps each entry aligned
 * with the corresponding `JobPayloadMap[K]` shape.
 */
import { z } from "zod";

import type { JobPayloadMap, JobType } from "@pluralscape/types";

/**
 * Type helper that recursively strips brand tags (`T & { readonly __brand }`)
 * so branded id fields in `JobPayloadMap` compare against the plain `string`
 * that `z.string()` produces. Leaves primitive/unbranded types untouched.
 */
type Unbrand<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends bigint
      ? bigint
      : T extends boolean
        ? boolean
        : T extends null
          ? null
          : T extends undefined
            ? undefined
            : T extends readonly (infer U)[]
              ? readonly Unbrand<U>[]
              : T extends object
                ? { readonly [K in keyof T]: Unbrand<T[K]> }
                : T;

export const PayloadSchemaByType = {
  "sync-push": z.record(z.string(), z.unknown()),
  "sync-pull": z.record(z.string(), z.unknown()),
  "blob-upload": z.record(z.string(), z.unknown()),
  "blob-cleanup": z.record(z.string(), z.never()),
  "export-generate": z.record(z.string(), z.unknown()),
  "import-process": z.record(z.string(), z.unknown()),
  "webhook-deliver": z.object({ deliveryId: z.string() }),
  "notification-send": z.object({
    accountId: z.string(),
    systemId: z.string(),
    deviceTokenId: z.string(),
    platform: z.string(),
    payload: z.object({
      title: z.string(),
      body: z.string(),
      data: z.record(z.string(), z.string()).nullable(),
    }),
  }),
  "analytics-compute": z.record(z.string(), z.unknown()),
  "account-purge": z.record(z.string(), z.unknown()),
  "bucket-key-rotation": z.record(z.string(), z.unknown()),
  "report-generate": z.record(z.string(), z.unknown()),
  "sync-queue-cleanup": z.record(z.string(), z.never()),
  "audit-log-cleanup": z.record(z.string(), z.never()),
  "partition-maintenance": z.record(z.string(), z.unknown()),
  "sync-compaction": z.object({ documentId: z.string(), systemId: z.string() }),
  "device-transfer-cleanup": z.record(z.string(), z.never()),
  "check-in-generate": z.record(z.string(), z.never()),
  "webhook-delivery-cleanup": z.record(z.string(), z.never()),
  "email-send": z.object({
    accountId: z.string(),
    template: z.string(),
    vars: z.record(z.string(), z.unknown()),
    recipientOverride: z.string().nullable(),
  }),
} as const satisfies Record<JobType, z.ZodType>;

/**
 * Compile-time conformance between the zod schemas above and `JobPayloadMap`.
 *
 * Bidirectional structural check after `Unbrand`-ing JobPayloadMap: the
 * schema's inferred shape must match the JobPayloadMap shape in both
 * directions (no extra/missing/renamed fields). When either side drifts, the
 * corresponding entry in this mapped type resolves to a descriptive string
 * literal instead of `true`, and the `_AssertAllTrue` constraint below fails
 * with the offending key in the error message.
 *
 * `Unbrand` is needed because JobPayloadMap uses branded string ids (e.g.
 * `WebhookDeliveryId`, `AccountId`) that zod's `z.string()` can't produce at
 * the type level — runtime acceptance is what the boundary actually needs, so
 * we compare the structural base types.
 *
 * Placeholder `JobPayloadMap` entries typed `Record<string, unknown>` /
 * `Record<string, never>` are satisfied by the generic `z.record(...)`
 * schemas — the check has teeth for the concrete-shape entries (`email-send`,
 * `notification-send`, `webhook-deliver`, `sync-compaction`).
 */
type _PayloadSchemaConformance = {
  [K in JobType]: z.infer<(typeof PayloadSchemaByType)[K]> extends Unbrand<JobPayloadMap[K]>
    ? Unbrand<JobPayloadMap[K]> extends z.infer<(typeof PayloadSchemaByType)[K]>
      ? true
      : `Schema for ${K} is narrower than JobPayloadMap[${K}]`
    : `Schema for ${K} disagrees with JobPayloadMap[${K}]`;
};

/**
 * Constraining `_PayloadSchemaConformance` to `Record<JobType, true>` is what
 * gives this check teeth: if any entry resolves to the drift string literal
 * above, the type fails to satisfy the constraint and tsc errors on this line
 * with the offending key in the message. A bare `const _check: T = {} as T`
 * would self-satisfy and silently pass.
 */
type _AssertAllTrue<T extends Record<JobType, true>> = T;
export type _PayloadSchemaDriftGuard = _AssertAllTrue<_PayloadSchemaConformance>;
