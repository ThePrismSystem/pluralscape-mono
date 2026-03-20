import { extractErrorMessage } from "@pluralscape/types";
import { now } from "@pluralscape/types/runtime";

import {
  DuplicateHandlerError,
  NoHandlersRegisteredError,
  WorkerAlreadyRunningError,
} from "../../errors.js";
import { ACK_RETRY_DELAY_MS, MAX_ACK_RETRIES, pollBackoffMs } from "../../queue.constants.js";

import type { HeartbeatHandle } from "../../heartbeat.js";
import type { JobQueue } from "../../job-queue.js";
import type { JobHandler, JobWorker } from "../../job-worker.js";
import type { JobDefinition, JobType, Logger, UnixMillis } from "@pluralscape/types";

const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5_000;
const SHUTDOWN_POLL_MS = 10;

/**
 * Polling-based job worker backed by a SqliteJobQueue.
 *
 * Polls the queue at a configurable interval and dispatches jobs to registered handlers.
 * Graceful shutdown aborts in-flight jobs via AbortController.
 */
export class SqliteJobWorker implements JobWorker {
  private readonly handlers = new Map<JobType, JobHandler>();
  private readonly queue: JobQueue;
  private readonly pollIntervalMs: number;
  private readonly shutdownTimeoutMs: number;
  private readonly logger: Logger;
  private readonly clock: () => UnixMillis;

  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly inFlight = new Map<string, AbortController>();
  private consecutivePollFailures = 0;
  private nextPollAt = 0 as UnixMillis;

  constructor(
    queue: JobQueue,
    {
      pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
      shutdownTimeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS,
      logger,
      clock,
    }: {
      pollIntervalMs?: number;
      shutdownTimeoutMs?: number;
      logger: Logger;
      clock?: () => UnixMillis;
    },
  ) {
    this.queue = queue;
    this.pollIntervalMs = pollIntervalMs;
    this.shutdownTimeoutMs = shutdownTimeoutMs;
    this.logger = logger;
    this.clock = clock ?? now;
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

    for (const controller of this.inFlight.values()) {
      controller.abort();
    }

    const deadline = this.clock() + this.shutdownTimeoutMs;
    while (this.inFlight.size > 0 && this.clock() < deadline) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, SHUTDOWN_POLL_MS);
      });
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
      this.logger.error("worker.poll-failed", { error: extractErrorMessage(err) });
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
        await this.queue.fail(job.id, `No handler registered for job type "${job.type}"`);
        return;
      }

      try {
        await handler(job, { heartbeat: heartbeatHandle, signal: controller.signal });
      } catch (err) {
        const message = extractErrorMessage(err);
        try {
          await this.queue.fail(job.id, message);
        } catch (failErr) {
          this.logger.error("worker.fail-failed", {
            jobId: job.id,
            error: extractErrorMessage(failErr),
          });
        }
        return;
      }

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
