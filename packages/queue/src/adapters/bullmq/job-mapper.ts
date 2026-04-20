import {
  brandId,
  JOB_STATUS_VALUES,
  JOB_TYPE_VALUES,
  toUnixMillis,
  toUnixMillisOrNull,
} from "@pluralscape/types";
import { z } from "zod";

import { PayloadSchemaByType } from "../../payload-schemas.js";

import type { JobDefinition, JobId, JobStatus, JobType, SystemId } from "@pluralscape/types";

/**
 * Raw shape of a completed/failed result as persisted on-wire.
 *
 * Timestamps are plain numbers at the deserialization boundary — the
 * `UnixMillis` brand is applied inside {@link fromStoredData}.
 */
export interface StoredJobResult {
  readonly success: boolean;
  readonly message: string | null;
  readonly completedAt: number;
}

/**
 * Schema for deserialized BullMQ `job.data`. Narrows `type` and `status` to
 * their discriminated-union literals so the parsed value already satisfies
 * {@link StoredJobData} without a trailing type assertion — the
 * `superRefine` additionally enforces that `payload` matches the variant
 * selected by `type`.
 *
 * Exported so every reader of `job.data` (queue adapter and worker alike)
 * can share a single validator and fail-closed contract.
 */
export const StoredJobDataSchema = z
  .object({
    systemId: z.string().nullable(),
    type: z.enum(JOB_TYPE_VALUES),
    payload: z.record(z.string(), z.unknown()),
    status: z.enum(JOB_STATUS_VALUES),
    attempts: z.number(),
    maxAttempts: z.number(),
    nextRetryAt: z.number().nullable(),
    error: z.string().nullable(),
    // Raw on-wire shape: `completedAt` is a plain number at the
    // deserialization boundary — it gets rebranded to `UnixMillis` inside
    // `fromStoredData`.
    result: z
      .object({
        success: z.boolean(),
        message: z.string().nullable(),
        completedAt: z.number(),
      })
      .nullable(),
    createdAt: z.number(),
    startedAt: z.number().nullable(),
    completedAt: z.number().nullable(),
    idempotencyKey: z.string().nullable(),
    lastHeartbeatAt: z.number().nullable(),
    timeoutMs: z.number(),
    scheduledFor: z.number().nullable(),
    priority: z.number(),
  })
  .superRefine((data, ctx) => {
    const schema = PayloadSchemaByType[data.type];
    const r = schema.safeParse(data.payload);
    if (!r.success) {
      ctx.addIssue({
        code: "custom",
        message: `Payload mismatch for type ${data.type}: ${r.error.message}`,
      });
    }
  });

/**
 * The shape of data stored inside each BullMQ job.
 * Contains our full JobDefinition fields (minus `id`, which is the BullMQ job ID).
 */
export interface StoredJobData {
  systemId: string | null;
  type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number | null;
  error: string | null;
  result: StoredJobResult | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  idempotencyKey: string | null;
  lastHeartbeatAt: number | null;
  timeoutMs: number;
  scheduledFor: number | null;
  priority: number;
}

/**
 * Reconstructs a JobDefinition from serialized StoredJobData + a job ID.
 *
 * Callers are responsible for validating `data` (via `StoredJobDataSchema` in
 * the bullmq adapter) before invoking this. Post-validation the correlated
 * discriminated union `JobDefinition` cannot be proved from two independently
 * typed fields (`type`, `payload`); the trailing cast is the minimal bridge.
 */
export function fromStoredData(id: JobId, data: StoredJobData): JobDefinition {
  return {
    id,
    systemId: data.systemId ? brandId<SystemId>(data.systemId) : null,
    type: data.type,
    status: data.status,
    payload: data.payload as Readonly<Record<string, unknown>>,
    attempts: data.attempts,
    maxAttempts: data.maxAttempts,
    nextRetryAt: toUnixMillisOrNull(data.nextRetryAt ?? null),
    error: data.error ?? null,
    result:
      data.result === null
        ? null
        : {
            success: data.result.success,
            message: data.result.message,
            completedAt: toUnixMillis(data.result.completedAt),
          },
    createdAt: toUnixMillis(data.createdAt),
    startedAt: toUnixMillisOrNull(data.startedAt ?? null),
    completedAt: toUnixMillisOrNull(data.completedAt ?? null),
    idempotencyKey: data.idempotencyKey ?? null,
    lastHeartbeatAt: toUnixMillisOrNull(data.lastHeartbeatAt ?? null),
    timeoutMs: data.timeoutMs,
    scheduledFor: toUnixMillisOrNull(data.scheduledFor ?? null),
    priority: data.priority,
  } as JobDefinition;
}
