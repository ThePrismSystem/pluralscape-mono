import type { JobEventHooks } from "./event-hooks.js";
import type { IdempotencyCheckResult, JobEnqueueParams, JobFilter } from "./types.js";
import type { JobDefinition, JobId, JobType, RetryPolicy } from "@pluralscape/types";

/**
 * Persistence and management adapter for the background job queue.
 *
 * Defines the contract for storing, retrieving, and transitioning job state.
 * The adapter is responsible for atomicity of status transitions (e.g., dequeue
 * must atomically move a job from pending → running to prevent double-processing).
 *
 * Implementations: BullMQ (cloud), SQLite (self-hosted / offline).
 */
export interface JobQueue {
  /**
   * Enqueues a new job.
   *
   * If a non-completed job with the same idempotency key already exists,
   * throws IdempotencyConflictError. If a completed job exists with the key,
   * enqueues a new job (allows re-runs after completion).
   */
  enqueue(params: JobEnqueueParams): Promise<JobDefinition>;

  /**
   * Checks whether a job with the given idempotency key exists.
   * Does not throw — use this to inspect state before deciding whether to enqueue.
   */
  checkIdempotency(key: string): Promise<IdempotencyCheckResult>;

  /**
   * Atomically dequeues the next eligible job and transitions it to running.
   *
   * Respects priority ordering (lower value = higher priority) and scheduledFor
   * (only dequeues jobs whose scheduledFor ≤ now). Returns null when the queue is empty
   * or all eligible jobs are already running.
   *
   * @param types - If provided, only dequeue jobs of these types.
   */
  dequeue(types?: readonly JobType[]): Promise<JobDefinition | null>;

  /**
   * Marks a running job as completed and records an optional result message.
   * Triggers the onComplete hook if configured.
   */
  acknowledge(jobId: JobId, result: { message?: string }): Promise<JobDefinition>;

  /**
   * Marks a running job as failed.
   *
   * If attempts < maxAttempts: transitions to pending with exponential backoff
   * delay applied to nextRetryAt.
   * If attempts >= maxAttempts: transitions to dead-letter and triggers onDeadLetter.
   * Always triggers onFail.
   */
  fail(jobId: JobId, error: string): Promise<JobDefinition>;

  /**
   * Resets a failed or dead-letter job to pending, clearing its error and
   * resetting nextRetryAt. Allows manual retry after inspection.
   */
  retry(jobId: JobId): Promise<JobDefinition>;

  /**
   * Cancels a pending or running job. Completed or dead-letter jobs cannot be cancelled.
   */
  cancel(jobId: JobId): Promise<JobDefinition>;

  /**
   * Returns a single job by ID, or null if it does not exist.
   */
  getJob(jobId: JobId): Promise<JobDefinition | null>;

  /**
   * Lists jobs matching the given filter. Results are ordered by priority then createdAt.
   */
  listJobs(filter: JobFilter): Promise<readonly JobDefinition[]>;

  /**
   * Lists all dead-lettered jobs, optionally filtered by type.
   */
  listDeadLettered(
    filter?: Pick<JobFilter, "type" | "systemId" | "limit" | "offset">,
  ): Promise<readonly JobDefinition[]>;

  /**
   * Updates the lastHeartbeatAt timestamp for a running job.
   * Throws JobNotFoundError if the job does not exist or is not running.
   */
  heartbeat(jobId: JobId): Promise<void>;

  /**
   * Returns all running jobs whose lastHeartbeatAt + timeoutMs is before now.
   * Used by the worker or a background sweep to detect and requeue stalled jobs.
   */
  findStalledJobs(): Promise<readonly JobDefinition[]>;

  /**
   * Returns the retry policy for a job type.
   * Falls back to a default policy if none has been set for this type.
   */
  getRetryPolicy(type: JobType): RetryPolicy;

  /**
   * Overrides the retry policy for a specific job type.
   */
  setRetryPolicy(type: JobType, policy: RetryPolicy): void;

  /**
   * Registers lifecycle hooks invoked on job state transitions.
   * Replaces any previously registered hooks.
   */
  setEventHooks(hooks: JobEventHooks): void;
}
