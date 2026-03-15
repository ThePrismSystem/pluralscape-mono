import {
  DuplicateHandlerError,
  NoHandlersRegisteredError,
  WorkerAlreadyRunningError,
} from "../errors.js";

import type { HeartbeatHandle } from "../heartbeat.js";
import type { JobQueue } from "../job-queue.js";
import type { JobHandler, JobWorker } from "../job-worker.js";
import type { JobDefinition, JobType } from "@pluralscape/types";

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

  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  /** Controllers for in-flight jobs — aborted on stop() */
  private readonly inFlight = new Map<string, AbortController>();

  constructor(
    queue: JobQueue,
    {
      pollIntervalMs = 50,
      shutdownTimeoutMs = 2000,
    }: { pollIntervalMs?: number; shutdownTimeoutMs?: number } = {},
  ) {
    this.queue = queue;
    this.pollIntervalMs = pollIntervalMs;
    this.shutdownTimeoutMs = shutdownTimeoutMs;
  }

  registerHandler(type: JobType, handler: JobHandler): void {
    if (this.running) throw new WorkerAlreadyRunningError();
    if (this.handlers.has(type)) throw new DuplicateHandlerError(type);
    this.handlers.set(type, handler);
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
    const deadline = Date.now() + this.shutdownTimeoutMs;
    while (this.inFlight.size > 0 && Date.now() < deadline) {
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

    const types = Array.from(this.handlers.keys());
    let job: JobDefinition | null;
    try {
      job = await this.queue.dequeue(types);
    } catch {
      return; // Swallow transient errors during polling
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
      await handler(job, { heartbeat: heartbeatHandle, signal: controller.signal });
      await this.queue.acknowledge(job.id, {});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        await this.queue.fail(job.id, message);
      } catch {
        // Swallow fail errors — job may have already been cancelled
      }
    } finally {
      this.inFlight.delete(job.id);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
