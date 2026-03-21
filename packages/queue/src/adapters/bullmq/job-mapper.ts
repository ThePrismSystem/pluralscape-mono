import { toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";

import type {
  JobDefinition,
  JobId,
  JobResult,
  JobStatus,
  JobType,
  SystemId,
} from "@pluralscape/types";

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
  result: JobResult | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  idempotencyKey: string | null;
  lastHeartbeatAt: number | null;
  timeoutMs: number;
  scheduledFor: number | null;
  priority: number;
}

/** Reconstructs a JobDefinition from serialized StoredJobData + a job ID. */
export function fromStoredData(id: JobId, data: StoredJobData): JobDefinition {
  return {
    id,
    systemId: (data.systemId ?? null) as SystemId | null,
    type: data.type,
    status: data.status,
    payload: data.payload as Readonly<Record<string, unknown>>,
    attempts: data.attempts,
    maxAttempts: data.maxAttempts,
    nextRetryAt: toUnixMillisOrNull(data.nextRetryAt ?? null),
    error: data.error ?? null,
    result: data.result ?? null,
    createdAt: toUnixMillis(data.createdAt),
    startedAt: toUnixMillisOrNull(data.startedAt ?? null),
    completedAt: toUnixMillisOrNull(data.completedAt ?? null),
    idempotencyKey: data.idempotencyKey ?? null,
    lastHeartbeatAt: toUnixMillisOrNull(data.lastHeartbeatAt ?? null),
    timeoutMs: data.timeoutMs,
    scheduledFor: toUnixMillisOrNull(data.scheduledFor ?? null),
    priority: data.priority,
  };
}
