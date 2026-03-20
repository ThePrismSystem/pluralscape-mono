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
  | "partition-maintenance"
  | "sync-compaction";

/** Current status of a background job. */
export type JobStatus = "pending" | "running" | "completed" | "cancelled" | "dead-letter";

/** Backoff strategy for retry timing. */
export type BackoffStrategy = "exponential" | "linear";

/** Retry policy for failed jobs. */
export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly backoffMultiplier: number;
  readonly maxBackoffMs: number;
  /** Defaults to `"exponential"` when omitted. */
  readonly strategy?: BackoffStrategy;
  /** Fraction of jitter to apply (e.g. 0.2 = +/- 20%). Defaults to 0 (no jitter). */
  readonly jitterFraction?: number;
}

/** Maps each job type to its expected payload shape. Augment with specific types as handlers are implemented. */
export interface JobPayloadMap {
  "sync-push": Record<string, unknown>;
  "sync-pull": Record<string, unknown>;
  "blob-upload": Record<string, unknown>;
  "blob-cleanup": Record<string, unknown>;
  "export-generate": Record<string, unknown>;
  "import-process": Record<string, unknown>;
  "webhook-deliver": Record<string, unknown>;
  "notification-send": Record<string, unknown>;
  "analytics-compute": Record<string, unknown>;
  "account-purge": Record<string, unknown>;
  "bucket-key-rotation": Record<string, unknown>;
  "report-generate": Record<string, unknown>;
  "sync-queue-cleanup": Record<string, unknown>;
  "audit-log-cleanup": Record<string, unknown>;
  "partition-maintenance": Record<string, unknown>;
  "sync-compaction": {
    readonly documentId: string;
    readonly systemId: string;
  };
}

/** Result of a completed or failed job. */
export interface JobResult {
  readonly success: boolean;
  readonly message: string | null;
  readonly completedAt: UnixMillis;
}

/** A background job definition. */
export interface JobDefinition<T extends JobType = JobType> {
  readonly id: JobId;
  readonly systemId: SystemId | null;
  readonly type: T;
  readonly status: JobStatus;
  readonly payload: Readonly<JobPayloadMap[T]>;
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
