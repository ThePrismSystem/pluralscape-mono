import type { HeartbeatHandle } from "./heartbeat.js";
import type { JobDefinition, JobType } from "@pluralscape/types";

/**
 * Context passed to a job handler during execution.
 */
export interface JobHandlerContext {
  /** Emits a heartbeat to prevent stalled-job detection. */
  readonly heartbeat: HeartbeatHandle;
  /**
   * Aborted when the worker is shutting down. Handlers should respect this signal
   * to exit gracefully within the configured shutdown timeout.
   */
  readonly signal: AbortSignal;
}

/** A function that processes a single job. Throw to signal failure. */
export type JobHandler = (job: JobDefinition, ctx: JobHandlerContext) => Promise<void>;

/**
 * Processing lifecycle adapter for the background job worker.
 *
 * A worker pulls jobs from a JobQueue, dispatches them to registered handlers,
 * and manages heartbeats, retries, and graceful shutdown.
 *
 * Implementations: BullMQ worker (cloud), in-memory polling worker (tests / self-hosted).
 */
export interface JobWorker {
  /**
   * Registers a handler for the given job type.
   *
   * Must be called before start(). Throws WorkerAlreadyRunningError if the worker
   * is already running. Throws DuplicateHandlerError if a handler for this type
   * is already registered.
   */
  registerHandler(type: JobType, handler: JobHandler): void;

  /**
   * Starts the worker, beginning job polling and processing.
   *
   * Throws WorkerAlreadyRunningError if already running.
   * Throws NoHandlersRegisteredError if no handlers have been registered.
   */
  start(): Promise<void>;

  /**
   * Stops the worker gracefully, waiting for in-flight jobs to complete
   * up to the configured shutdown timeout before forcibly aborting them.
   */
  stop(): Promise<void>;

  /** Returns true if the worker is currently polling and processing jobs. */
  isRunning(): boolean;

  /** Returns the job types for which handlers are registered. */
  registeredTypes(): readonly JobType[];
}
