import { extractErrorMessage } from "@pluralscape/types";
import { now } from "@pluralscape/types/runtime";

import {
  DuplicateHandlerError,
  NoHandlersRegisteredError,
  WorkerAlreadyRunningError,
} from "../errors.js";
import {
  ACK_RETRY_DELAY_MS,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  MAX_ACK_RETRIES,
  SHUTDOWN_POLL_MS,
  pollBackoffMs,
} from "../queue.constants.js";

import type { HeartbeatHandle } from "../heartbeat.js";
import type { JobQueue } from "../job-queue.js";
import type { JobHandler, JobWorker } from "../job-worker.js";
import type { JobDefinition, JobId, JobType, Logger, UnixMillis } from "@pluralscape/types";

/**
 * Options shared by all BaseJobWorker subclasses.
 */
export interface BaseJobWorkerOptions {
  pollIntervalMs?: number;
  shutdownTimeoutMs?: number;
  logger: Logger;
  clock?: () => UnixMillis;
}

/**
 * Abstract base class for polling-based job workers.
 *
 * Encapsulates the shared lifecycle (start/stop, handler registration,
 * graceful shutdown with AbortController, ack-retry loop) so that
 * adapter-specific subclasses only need to implement poll() and
 * createHeartbeatHandle().
 */
export abstract class BaseJobWorker implements JobWorker {
  protected readonly handlers = new Map<JobType, JobHandler>();
  protected readonly queue: JobQueue;
  protected readonly pollIntervalMs: number;
  protected readonly shutdownTimeoutMs: number;
  protected readonly logger: Logger;
  protected readonly clock: () => UnixMillis;

  protected running = false;
  protected pollTimer: ReturnType<typeof setInterval> | null = null;
  protected readonly inFlight = new Map<string, AbortController>();
  protected consecutivePollFailures = 0;
  protected nextPollAt = 0 as UnixMillis;

  constructor(queue: JobQueue, options: BaseJobWorkerOptions) {
    this.queue = queue;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.shutdownTimeoutMs = options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
    this.logger = options.logger;
    this.clock = options.clock ?? now;
  }

  registerHandler<T extends JobType>(type: T, handler: JobHandler<T>): void {
    if (this.running) throw new WorkerAlreadyRunningError();
    if (this.handlers.has(type)) throw new DuplicateHandlerError(type);
    this.handlers.set(type, handler as JobHandler);
  }

  start(): Promise<void> {
    if (this.running) return Promise.reject(new WorkerAlreadyRunningError());
    if (this.handlers.size === 0) return Promise.reject(new NoHandlersRegisteredError());
    this.running = true;
    this.onStart();
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
    return Promise.resolve();
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    for (const controller of this.inFlight.values()) {
      controller.abort();
    }

    const deadline = this.clock() + this.shutdownTimeoutMs;
    while (this.inFlight.size > 0 && this.clock() < deadline) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, SHUTDOWN_POLL_MS);
      });
    }

    await this.onStop();
  }

  isRunning(): boolean {
    return this.running;
  }

  registeredTypes(): readonly JobType[] {
    return Array.from(this.handlers.keys());
  }

  // ── Template methods for subclasses ───────────────────────────────

  /** Called during start() before the poll timer begins. Override to initialise adapter resources. */
  protected onStart(): void {
    // default no-op
  }

  /** Called during stop() after in-flight jobs have drained. Override to clean up adapter resources. */
  protected onStop(): Promise<void> {
    return Promise.resolve();
  }

  /** Adapter-specific poll implementation. Called on each tick of the poll interval. */
  protected abstract poll(): Promise<void>;

  /**
   * Creates a HeartbeatHandle for the given job.
   * Subclasses may provide adapter-specific heartbeat logic.
   */
  protected createHeartbeatHandle(jobId: JobId): HeartbeatHandle {
    return {
      heartbeat: async () => {
        await this.queue.heartbeat(jobId);
      },
    };
  }

  // ── Shared processing logic ───────────────────────────────────────

  /**
   * Handles backoff tracking after a poll failure.
   * Returns early so the caller can exit poll().
   */
  protected handlePollFailure(err: unknown): void {
    this.consecutivePollFailures++;
    this.nextPollAt = (this.clock() + pollBackoffMs(this.consecutivePollFailures)) as UnixMillis;
    this.logger.error("worker.poll-failed", { error: extractErrorMessage(err) });
  }

  /** Resets the consecutive poll failure counter after a successful poll. */
  protected handlePollSuccess(): void {
    this.consecutivePollFailures = 0;
  }

  /** Returns true if polling should be skipped this tick (not running or in backoff). */
  protected shouldSkipPoll(): boolean {
    return !this.running || this.clock() < this.nextPollAt;
  }

  /**
   * Processes a dequeued job: invokes the handler, runs the ack-retry loop on
   * success, and calls queue.fail() on handler errors.
   *
   * @param job - The job definition to process.
   * @param heartbeatHandle - Adapter-specific heartbeat handle for this job.
   */
  protected async processJob(job: JobDefinition, heartbeatHandle: HeartbeatHandle): Promise<void> {
    const controller = new AbortController();
    this.inFlight.set(job.id, controller);

    try {
      const handler = this.handlers.get(job.type);
      if (handler === undefined) {
        try {
          await this.queue.fail(job.id, `No handler registered for job type "${job.type}"`);
        } catch (err) {
          this.logger.error("worker.fail-delegation-error", {
            jobId: job.id,
            error: extractErrorMessage(err),
          });
        }
        return;
      }

      try {
        await handler(job, { heartbeat: heartbeatHandle, signal: controller.signal });
      } catch (err) {
        const message = extractErrorMessage(err);
        try {
          await this.queue.fail(job.id, message);
        } catch (failErr) {
          this.logger.error("worker.fail-delegation-error", {
            jobId: job.id,
            error: extractErrorMessage(failErr),
          });
        }
        return;
      }

      // Handler succeeded — acknowledge with retry
      let ackAttempt = 0;
      while (ackAttempt < MAX_ACK_RETRIES) {
        try {
          await this.queue.acknowledge(job.id, {});
          break;
        } catch (err) {
          ackAttempt++;
          const msg = extractErrorMessage(err);
          if (ackAttempt >= MAX_ACK_RETRIES) {
            this.logger.error("worker.acknowledge-exhausted", {
              jobId: job.id,
              error: msg,
              attempts: ackAttempt,
            });
          } else {
            this.logger.warn("worker.acknowledge-retry", {
              jobId: job.id,
              error: msg,
              attempt: ackAttempt,
            });
            await new Promise<void>((r) => {
              setTimeout(r, ACK_RETRY_DELAY_MS);
            });
          }
        }
      }
    } finally {
      this.inFlight.delete(job.id);
    }
  }
}
