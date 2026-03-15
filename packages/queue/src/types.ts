import type {
  JobDefinition,
  JobPayloadMap,
  JobStatus,
  JobType,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

/** Parameters for enqueuing a new job. */
export interface JobEnqueueParams<T extends JobType = JobType> {
  readonly type: T;
  readonly systemId: SystemId | null;
  readonly payload: Readonly<JobPayloadMap[T]>;
  /** Unique key to prevent duplicate jobs. */
  readonly idempotencyKey: string;
  /** Lower value = higher priority (0 is highest). Defaults to 0. */
  readonly priority?: number;
  /** Unix timestamp after which the job may be dequeued. Null means immediately. */
  readonly scheduledFor?: UnixMillis;
  /** Maximum ms the job may run before being considered stalled. */
  readonly timeoutMs?: number;
  /** Maximum number of attempts before moving to dead-letter. */
  readonly maxAttempts?: number;
}

/** Filter for listing jobs. */
export interface JobFilter {
  readonly type?: JobType;
  readonly status?: JobStatus;
  readonly systemId?: SystemId;
  readonly limit?: number;
  readonly offset?: number;
}

/** Result of checking whether a job with a given idempotency key already exists. */
export type IdempotencyCheckResult =
  | { readonly exists: false }
  | { readonly exists: true; readonly existingJob: JobDefinition };
