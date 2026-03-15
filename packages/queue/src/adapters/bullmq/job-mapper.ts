import type {
  JobDefinition,
  JobId,
  JobResult,
  JobStatus,
  JobType,
  SystemId,
  UnixMillis,
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

/** Builds StoredJobData from a JobDefinition (strips the `id` field). */
export function toStoredData(def: JobDefinition): StoredJobData {
  return {
    systemId: def.systemId,
    type: def.type,
    payload: def.payload as Record<string, unknown>,
    status: def.status,
    attempts: def.attempts,
    maxAttempts: def.maxAttempts,
    nextRetryAt: def.nextRetryAt,
    error: def.error,
    result: def.result,
    createdAt: def.createdAt,
    startedAt: def.startedAt,
    completedAt: def.completedAt,
    idempotencyKey: def.idempotencyKey,
    lastHeartbeatAt: def.lastHeartbeatAt,
    timeoutMs: def.timeoutMs,
    scheduledFor: def.scheduledFor,
    priority: def.priority,
  };
}

/** Reconstructs a JobDefinition from serialized StoredJobData + a job ID. */
export function fromStoredData(id: string, data: StoredJobData): JobDefinition {
  return {
    id: id as JobId,
    systemId: (data.systemId ?? null) as SystemId | null,
    type: data.type,
    status: data.status,
    payload: data.payload as Readonly<Record<string, unknown>>,
    attempts: data.attempts,
    maxAttempts: data.maxAttempts,
    nextRetryAt: (data.nextRetryAt ?? null) as UnixMillis | null,
    error: data.error ?? null,
    result: data.result ?? null,
    createdAt: data.createdAt as UnixMillis,
    startedAt: (data.startedAt ?? null) as UnixMillis | null,
    completedAt: (data.completedAt ?? null) as UnixMillis | null,
    idempotencyKey: data.idempotencyKey ?? null,
    lastHeartbeatAt: (data.lastHeartbeatAt ?? null) as UnixMillis | null,
    timeoutMs: data.timeoutMs,
    scheduledFor: (data.scheduledFor ?? null) as UnixMillis | null,
    priority: data.priority,
  };
}
