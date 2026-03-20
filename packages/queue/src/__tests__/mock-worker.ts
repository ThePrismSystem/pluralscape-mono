import { now } from "@pluralscape/types/runtime";

import {
  DuplicateHandlerError,
  NoHandlersRegisteredError,
  WorkerAlreadyRunningError,
} from "../errors.js";
import { ACK_RETRY_DELAY_MS, MAX_ACK_RETRIES, pollBackoffMs } from "../queue.constants.js";

import { delay } from "./helpers.js";

import type { HeartbeatHandle } from "../heartbeat.js";
import type { JobQueue } from "../job-queue.js";
import type { JobHandler, JobWorker } from "../job-worker.js";
import type { JobDefinition, JobType, Logger, UnixMillis } from "@pluralscape/types";

/**
 * In-memory implementation of JobWorker for use in contract tests.
 *
 * Polls the queue at a configurable interval and dispatches jobs to registered handlers.
 * Designed for test use: short poll intervals and fast shutdown.
 */
export class InMemoryJobWorker implements JobWorker {
  private readonly handlers = new Map<JobType, JobHandler>();
  private readonly queue: JobQueue;
  private readonly pollIntervalMs: number;
  private readonly shutdownTimeoutMs: number;
  private readonly logger: Logger | undefined;
  private readonly clock: () => UnixMillis;

  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  /** Controllers for in-flight jobs — aborted on stop() */
  private readonly inFlight = new Map<string, AbortController>();
  private consecutivePollFailures = 0;
  private nextPollAt = 0 as UnixMillis;

  constructor(
    queue: JobQueue,
    {
      pollIntervalMs = 50,
      shutdownTimeoutMs = 2000,
      logger,
      clock,
    }: {
      pollIntervalMs?: number;
      shutdownTimeoutMs?: number;
      logger?: Logger;
      clock?: () => UnixMillis;
    } = {},
  ) {
    this.queue = queue;
    this.pollIntervalMs = pollIntervalMs;
    this.shutdownTimeoutMs = shutdownTimeoutMs;
    this.logger = logger;
    this.clock = clock ?? now;
  }

  get pollFailureCount(): number {
    return this.consecutivePollFailures;
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

    // Signal all in-flight jobs to abort
    for (const controller of this.inFlight.values()) {
      controller.abort();
    }

    // Wait for in-flight jobs to finish, up to shutdownTimeoutMs
    const deadline = this.clock() + this.shutdownTimeoutMs;
    while (this.inFlight.size > 0 && this.clock() < deadline) {
      await delay(10);
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  registeredTypes(): readonly JobType[] {
    return Array.from(this.handlers.keys());
  }

  // ── Private ─────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    if (!this.running) return;
    if (this.clock() < this.nextPollAt) return;

    const types = Array.from(this.handlers.keys());
    let job: JobDefinition | null;
    try {
      job = await this.queue.dequeue(types);
      this.consecutivePollFailures = 0;
    } catch (err) {
      this.consecutivePollFailures++;
      this.nextPollAt = (this.clock() + pollBackoffMs(this.consecutivePollFailures)) as UnixMillis;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger?.error("worker.poll-failed", { error: msg });
      return;
    }

    if (job === null) return;

    void this.processJob(job);
  }

  private async processJob(job: JobDefinition): Promise<void> {
    const controller = new AbortController();
    this.inFlight.set(job.id, controller);

    const heartbeatHandle: HeartbeatHandle = {
      heartbeat: async () => {
        await this.queue.heartbeat(job.id);
      },
    };

    try {
      const handler = this.handlers.get(job.type);
      if (handler === undefined) {
        // No handler registered for this type — fail it
        await this.queue.fail(job.id, `No handler registered for job type "${job.type}"`);
        return;
      }

      // Run handler — if it throws, fail the job
      try {
        await handler(job, { heartbeat: heartbeatHandle, signal: controller.signal });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        try {
          await this.queue.fail(job.id, message);
        } catch (failErr) {
          const failMsg = failErr instanceof Error ? failErr.message : String(failErr);
          this.logger?.error("worker.fail-failed", { jobId: job.id, error: failMsg });
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
          const msg = err instanceof Error ? err.message : String(err);
          if (ackAttempt >= MAX_ACK_RETRIES) {
            this.logger?.error("worker.acknowledge-exhausted", {
              jobId: job.id,
              error: msg,
              attempts: ackAttempt,
            });
          } else {
            this.logger?.warn("worker.acknowledge-retry", {
              jobId: job.id,
              error: msg,
              attempt: ackAttempt,
            });
            await delay(ACK_RETRY_DELAY_MS);
          }
        }
      }
    } finally {
      this.inFlight.delete(job.id);
    }
  }
}
