// @pluralscape/queue — backend-agnostic job queue adapter interface

// ── Types ───────────────────────────────────────────────────────────
export type { IdempotencyCheckResult, JobEnqueueParams, JobFilter } from "./types.js";

// ── Interfaces ──────────────────────────────────────────────────────
export type { JobEventHooks } from "./event-hooks.js";
export type { HeartbeatHandle } from "./heartbeat.js";
export type { JobQueue } from "./job-queue.js";
export type { JobHandler, JobHandlerContext, JobWorker } from "./job-worker.js";

// ── Errors ──────────────────────────────────────────────────────────
export {
  DuplicateHandlerError,
  IdempotencyConflictError,
  InvalidJobTransitionError,
  JobNotFoundError,
  NoHandlersRegisteredError,
  WorkerAlreadyRunningError,
} from "./errors.js";
