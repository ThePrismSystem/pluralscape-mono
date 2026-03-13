import type { JobId, SystemId } from "./ids.js";
import type { UnixMillis } from "./timestamps.js";

/** The kind of background job. */
export type JobType =
  | "sync-push"
  | "sync-pull"
  | "blob-upload"
  | "blob-cleanup"
  | "export-generate"
  | "import-process"
  | "webhook-deliver"
  | "notification-send"
  | "analytics-compute"
  | "account-purge"
  | "bucket-key-rotation"
  | "report-generate"
  | "sync-queue-cleanup"
  | "audit-log-cleanup"
  | "partition-maintenance";

/** Current status of a background job. */
export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "dead-letter";

/** Retry policy for failed jobs. */
export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly backoffMultiplier: number;
  readonly maxBackoffMs: number;
}

/** Result of a completed or failed job. */
export interface JobResult {
  readonly success: boolean;
  readonly message: string | null;
  readonly completedAt: UnixMillis;
}

/** A background job definition. */
export interface JobDefinition {
  readonly id: JobId;
  readonly systemId: SystemId | null;
  readonly type: JobType;
  readonly status: JobStatus;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly nextRetryAt: UnixMillis | null;
  readonly error: string | null;
  readonly result: JobResult | null;
  readonly createdAt: UnixMillis;
  readonly startedAt: UnixMillis | null;
  readonly completedAt: UnixMillis | null;
  readonly idempotencyKey: string | null;
  readonly lastHeartbeatAt: UnixMillis | null;
  /** Conservative baseline timeout in ms; job types with long-running work should override. */
  readonly timeoutMs: number;
  readonly scheduledFor: UnixMillis | null;
  /** Lower value = higher priority (0 is highest). Matches BullMQ convention. */
  readonly priority: number;
}
