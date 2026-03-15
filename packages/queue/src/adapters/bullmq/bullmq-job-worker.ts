import { now } from "@pluralscape/types/runtime";
import { Worker } from "bullmq";

import {
  DuplicateHandlerError,
  NoHandlersRegisteredError,
  WorkerAlreadyRunningError,
} from "../../errors.js";

import { fromStoredData } from "./job-mapper.js";

import type { StoredJobData } from "./job-mapper.js";
import type { HeartbeatHandle } from "../../heartbeat.js";
import type { JobHandler, JobWorker } from "../../job-worker.js";
import type { JobDefinition, JobType } from "@pluralscape/types";
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
  private readonly pollIntervalMs: number;
  private readonly shutdownTimeoutMs: number;

  private worker: Worker | null = null;
  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly inFlight = new Map<string, AbortController>();
  private readonly token: string;

  constructor(
    queueName: string,
    connection: IORedis,
    options?: { pollIntervalMs?: number; shutdownTimeoutMs?: number },
  ) {
    this.queueName = queueName;
    this.connection = connection;
    this.pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.shutdownTimeoutMs = options?.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
    this.token = `worker-${String(now())}-${Math.random().toString(BASE_36).slice(2)}`;
  }

  registerHandler(type: JobType, handler: JobHandler): void {
    if (this.running) throw new WorkerAlreadyRunningError();
    if (this.handlerMap.has(type)) throw new DuplicateHandlerError(type);
    this.handlerMap.set(type, handler);
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

    const deadline = now() + this.shutdownTimeoutMs;
    while (this.inFlight.size > 0 && now() < deadline) {
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

    let bullmqJob: BullMQJob | undefined;
    try {
      bullmqJob = (await this.worker.getNextJob(this.token)) as BullMQJob | undefined;
    } catch {
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
      startedAt: now(),
      lastHeartbeatAt: now(),
    };
    await bullmqJob.updateData(runningData);

    const job: JobDefinition = fromStoredData(jobId, runningData);

    const heartbeatHandle: HeartbeatHandle = {
      heartbeat: async () => {
        // Update heartbeat directly on the BullMQ job data
        const data = bullmqJob.data as StoredJobData;
        await bullmqJob.updateData({ ...data, lastHeartbeatAt: now() });
      },
    };

    try {
      const handler = this.handlerMap.get(job.type);
      if (handler === undefined) {
        const failData: StoredJobData = {
          ...runningData,
          status: "dead-letter",
          attempts: runningData.attempts + 1,
          error: `No handler registered for job type "${job.type}"`,
        };
        await bullmqJob.updateData(failData);
        await bullmqJob.moveToFailed(
          new Error(`No handler registered for job type "${job.type}"`),
          this.token,
          false,
        );
        return;
      }

      try {
        await handler(job, { heartbeat: heartbeatHandle, signal: controller.signal });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Handle failure with our retry logic
        const newAttempts = runningData.attempts + 1;
        if (newAttempts >= runningData.maxAttempts) {
          const dlData: StoredJobData = {
            ...runningData,
            status: "dead-letter",
            attempts: newAttempts,
            error: message,
            result: { success: false, message, completedAt: now() },
          };
          await bullmqJob.updateData(dlData);
          await bullmqJob.moveToFailed(new Error(message), this.token, false);
        } else {
          const retryData: StoredJobData = {
            ...runningData,
            status: "pending",
            attempts: newAttempts,
            error: message,
          };
          await bullmqJob.updateData(retryData);
          await bullmqJob.moveToDelayed(now(), this.token);
        }
        return;
      }

      // Handler succeeded — complete the job
      const completedData: StoredJobData = {
        ...runningData,
        status: "completed",
        completedAt: now(),
        result: { success: true, message: null, completedAt: now() },
      };
      await bullmqJob.updateData(completedData);
      try {
        await bullmqJob.moveToCompleted("done", this.token, false);
      } catch {
        // Job may have already been completed
      }
    } finally {
      this.inFlight.delete(jobId);
    }
  }
}
