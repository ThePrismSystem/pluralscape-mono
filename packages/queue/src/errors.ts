import type { JobId, JobStatus, JobType } from "@pluralscape/types";

export type JobAction = "acknowledge" | "fail" | "retry" | "cancel" | "dequeue" | "heartbeat";

/**
 * Thrown when enqueue is called with an idempotency key that matches an existing
 * non-completed job (pending or running). Callers should use checkIdempotency() first
 * if they need to distinguish between a conflict and a fresh enqueue.
 */
export class IdempotencyConflictError extends Error {
  override readonly name = "IdempotencyConflictError" as const;
  readonly idempotencyKey: string;

  constructor(idempotencyKey: string, options?: ErrorOptions) {
    super(`A non-completed job already exists with idempotency key "${idempotencyKey}".`, options);
    this.idempotencyKey = idempotencyKey;
  }
}

/**
 * Thrown when an operation targets a job ID that does not exist in the queue.
 */
export class JobNotFoundError extends Error {
  override readonly name = "JobNotFoundError" as const;
  readonly jobId: JobId;

  constructor(jobId: JobId, options?: ErrorOptions) {
    super(`Job "${jobId}" not found.`, options);
    this.jobId = jobId;
  }
}

/**
 * Thrown when start() or registerHandler() is called on an already-running worker.
 */
export class WorkerAlreadyRunningError extends Error {
  override readonly name = "WorkerAlreadyRunningError" as const;

  constructor(options?: ErrorOptions) {
    super("Worker is already running. Stop it before calling start() again.", options);
  }
}

/**
 * Thrown when start() is called on a worker with no registered handlers.
 */
export class NoHandlersRegisteredError extends Error {
  override readonly name = "NoHandlersRegisteredError" as const;

  constructor(options?: ErrorOptions) {
    super(
      "No job handlers registered. Register at least one handler before calling start().",
      options,
    );
  }
}

/**
 * Thrown when registerHandler() is called for a job type that already has a handler.
 */
export class DuplicateHandlerError extends Error {
  override readonly name = "DuplicateHandlerError" as const;
  readonly jobType: JobType;

  constructor(jobType: JobType, options?: ErrorOptions) {
    super(`A handler for job type "${jobType}" is already registered.`, options);
    this.jobType = jobType;
  }
}

/**
 * Thrown when stored job data in the backing store (Redis hash, SQLite row)
 * cannot be parsed into a valid {@link StoredJobData} shape.
 *
 * Wraps the underlying parse error as `cause` so diagnostics are preserved
 * without leaking a bare `SyntaxError` / Zod `ZodError` across the queue API
 * boundary. Callers receive a typed, stable error they can branch on.
 *
 * Pass a `details` string to surface a compact, operator-readable summary in
 * the top-level message — otherwise operators must chase `error.cause` for
 * actionable context (path, field, reason). Keep details short; the full
 * structured error stays on `cause`.
 */
export class QueueCorruptionError extends Error {
  override readonly name = "QueueCorruptionError" as const;
  readonly jobId: JobId;

  constructor(jobId: JobId, details?: string, options?: ErrorOptions) {
    const base = `Corrupt stored data for job "${jobId}".`;
    super(details === undefined || details.length === 0 ? base : `${base} ${details}`, options);
    this.jobId = jobId;
  }
}

/**
 * Thrown when a state transition is attempted on a job whose current status
 * does not permit it (e.g. acknowledging a pending job).
 */
export class InvalidJobTransitionError extends Error {
  override readonly name = "InvalidJobTransitionError" as const;
  readonly jobId: JobId;
  readonly currentStatus: JobStatus;
  readonly attemptedAction: JobAction;

  constructor(
    jobId: JobId,
    currentStatus: JobStatus,
    attemptedAction: JobAction,
    options?: ErrorOptions,
  ) {
    super(`Cannot ${attemptedAction} job "${jobId}": job is "${currentStatus}".`, options);
    this.jobId = jobId;
    this.currentStatus = currentStatus;
    this.attemptedAction = attemptedAction;
  }
}
