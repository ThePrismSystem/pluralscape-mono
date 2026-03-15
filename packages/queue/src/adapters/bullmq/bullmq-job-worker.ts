import { now } from "@pluralscape/types/runtime";
import { Worker } from "bullmq";

import {
  DuplicateHandlerError,
  NoHandlersRegisteredError,
  WorkerAlreadyRunningError,
} from "../../errors.js";
import { pollBackoffMs } from "../../queue.constants.js";

import { fromStoredData } from "./job-mapper.js";

import type { StoredJobData } from "./job-mapper.js";
import type { HeartbeatHandle } from "../../heartbeat.js";
import type { JobQueue } from "../../job-queue.js";
import type { JobHandler, JobWorker } from "../../job-worker.js";
import type { JobLogger } from "../../observability/job-logger.js";
import type { JobDefinition, JobType, UnixMillis } from "@pluralscape/types";
import type { Job as BullMQJob } from "bullmq";
import type IORedis from "ioredis";

const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5_000;
const SHUTDOWN_POLL_MS = 10;
const BASE_36 = 36;

/**
 * BullMQ-backed implementation of JobWorker.
 *
 * Uses a BullMQ Worker in manual-fetch mode (no processor), polling
 * with `getNextJob()` for full control over job state transitions.
 */
export class BullMQJobWorker implements JobWorker {
  private readonly handlerMap = new Map<JobType, JobHandler>();
  private readonly queueName: string;
  private readonly connection: IORedis;
  private readonly queue: JobQueue;
  private readonly pollIntervalMs: number;
  private readonly shutdownTimeoutMs: number;
  private readonly logger: JobLogger | undefined;
  private readonly clock: () => UnixMillis;

  private worker: Worker | null = null;
  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly inFlight = new Map<string, AbortController>();
  private readonly token: string;
  private consecutivePollFailures = 0;
  private nextPollAt = 0 as UnixMillis;

  constructor(
    queueName: string,
    connection: IORedis,
    queue: JobQueue,
    options?: {
      pollIntervalMs?: number;
      shutdownTimeoutMs?: number;
      logger?: JobLogger;
      clock?: () => UnixMillis;
    },
  ) {
    this.queueName = queueName;
    this.connection = connection;
    this.queue = queue;
    this.pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.shutdownTimeoutMs = options?.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
    this.logger = options?.logger;
    this.clock = options?.clock ?? now;
    this.token = `worker-${String(now())}-${Math.random().toString(BASE_36).slice(2)}`;
  }

  registerHandler<T extends JobType>(type: T, handler: JobHandler<T>): void {
    if (this.running) throw new WorkerAlreadyRunningError();
    if (this.handlerMap.has(type)) throw new DuplicateHandlerError(type);
    // Safe: the map stores wide JobHandler, but callers get type safety at the call site
    this.handlerMap.set(type, handler as JobHandler);
  }

  start(): Promise<void> {
    if (this.running) return Promise.reject(new WorkerAlreadyRunningError());
    if (this.handlerMap.size === 0) return Promise.reject(new NoHandlersRegisteredError());

    this.running = true;

    // Worker in manual mode (no processor, autorun false)
    this.worker = new Worker(this.queueName, undefined, {
      connection: this.connection,
      autorun: false,
    });

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

    if (this.worker !== null) {
      await this.worker.close();
      this.worker = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  registeredTypes(): readonly JobType[] {
    return Array.from(this.handlerMap.keys());
  }

  // ── Private ─────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    if (!this.running || this.worker === null) return;
    if (this.clock() < this.nextPollAt) return;

    let bullmqJob: BullMQJob | undefined;
    try {
      bullmqJob = (await this.worker.getNextJob(this.token)) as BullMQJob | undefined;
      this.consecutivePollFailures = 0;
    } catch (err) {
      this.consecutivePollFailures++;
      this.nextPollAt = (this.clock() + pollBackoffMs(this.consecutivePollFailures)) as UnixMillis;
      const message = err instanceof Error ? err.message : String(err);
      this.logger?.error("worker.poll-failed", { error: message });
      return;
    }

    if (bullmqJob === undefined) return;
    void this.processJob(bullmqJob);
  }

  private async processJob(bullmqJob: BullMQJob): Promise<void> {
    const controller = new AbortController();
    const jobId = bullmqJob.id as string;
    this.inFlight.set(jobId, controller);

    // Update status to running
    const currentData = bullmqJob.data as StoredJobData;
    const runningData: StoredJobData = {
      ...currentData,
      status: "running",
      startedAt: this.clock(),
      lastHeartbeatAt: this.clock(),
    };
    await bullmqJob.updateData(runningData);

    const job: JobDefinition = fromStoredData(jobId, runningData);

    const heartbeatHandle: HeartbeatHandle = {
      heartbeat: async () => {
        // Update heartbeat directly on the BullMQ job data
        const data = bullmqJob.data as StoredJobData;
        await bullmqJob.updateData({ ...data, lastHeartbeatAt: this.clock() });
      },
    };

    try {
      const handler = this.handlerMap.get(job.type);
      if (handler === undefined) {
        try {
          await this.queue.fail(job.id, `No handler registered for job type "${job.type}"`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger?.error("worker.fail-delegation-error", { jobId: job.id, error: msg });
        }
        return;
      }

      try {
        await handler(job, { heartbeat: heartbeatHandle, signal: controller.signal });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        try {
          await this.queue.fail(job.id, message);
        } catch (failErr) {
          const msg = failErr instanceof Error ? failErr.message : String(failErr);
          this.logger?.error("worker.fail-delegation-error", { jobId: job.id, error: msg });
        }
        return;
      }

      // Handler succeeded — delegate to queue for completion hooks
      try {
        await this.queue.acknowledge(job.id, {});
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger?.error("worker.acknowledge-delegation-error", { jobId: job.id, error: msg });
      }
    } finally {
      this.inFlight.delete(jobId);
    }
  }
}
