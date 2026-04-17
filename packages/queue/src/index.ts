// @pluralscape/queue — backend-agnostic job queue adapter interface

// ── Types ───────────────────────────────────────────────────────────
export {
  AUDIT_LOG_CLEANUP_CRON,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS,
  WEBHOOK_DELIVERY_CLEANUP_CRON,
} from "./queue.constants.js";
export { PayloadSchemaByType } from "./payload-schemas.js";
export type { IdempotencyCheckResult, JobEnqueueParams, JobFilter } from "./types.js";

// ── Base classes ────────────────────────────────────────────────────
export { BaseJobWorker } from "./adapters/base-job-worker.js";
export type { BaseJobWorkerOptions } from "./adapters/base-job-worker.js";

// ── Interfaces ──────────────────────────────────────────────────────
export type { JobEventHooks } from "./event-hooks.js";
export type { HeartbeatHandle } from "./heartbeat.js";
export type { JobQueue } from "./job-queue.js";
export type { JobHandler, JobHandlerContext, JobWorker } from "./job-worker.js";

// ── Errors ──────────────────────────────────────────────────────────
export type { JobAction } from "./errors.js";
export {
  DuplicateHandlerError,
  IdempotencyConflictError,
  InvalidJobTransitionError,
  JobNotFoundError,
  NoHandlersRegisteredError,
  QueueCorruptionError,
  WorkerAlreadyRunningError,
} from "./errors.js";
