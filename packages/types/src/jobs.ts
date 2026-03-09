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
  | "report-generate";

/** Current status of a background job. */
export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

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
  readonly systemId: SystemId;
  readonly type: JobType;
  readonly status: JobStatus;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly retryPolicy: RetryPolicy;
  readonly attempts: number;
  readonly result: JobResult | null;
  readonly scheduledAt: UnixMillis;
  readonly startedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
}
