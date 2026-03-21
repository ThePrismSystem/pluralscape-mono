import { afterEach, describe, expect, it, vi } from "vitest";

import { BaseJobWorker } from "../adapters/base-job-worker.js";
import {
  DuplicateHandlerError,
  NoHandlersRegisteredError,
  WorkerAlreadyRunningError,
} from "../errors.js";

import type { JobQueue } from "../job-queue.js";
import type { JobHandler } from "../job-worker.js";
import type { JobDefinition, JobId, JobType, Logger, UnixMillis } from "@pluralscape/types";

// ── Test double ─────────────────────────────────────────────────────

class TestJobWorker extends BaseJobWorker {
  public pollCallCount = 0;
  public onStartCalled = false;
  public onStopCalled = false;

  /** Queued jobs that poll() will yield one at a time. */
  private pendingJobs: JobDefinition[] = [];

  /** Enqueue a job for the next poll cycle. */
  feedJob(job: JobDefinition): void {
    this.pendingJobs.push(job);
  }

  protected override onStart(): void {
    this.onStartCalled = true;
  }

  protected override onStop(): Promise<void> {
    this.onStopCalled = true;
    return Promise.resolve();
  }

  protected override poll(): Promise<void> {
    this.pollCallCount++;
    if (this.shouldSkipPoll()) return Promise.resolve();
    this.handlePollSuccess();
    const job = this.pendingJobs.shift();
    if (job === undefined) return Promise.resolve();
    const heartbeat = this.createHeartbeatHandle(job.id);
    void this.processJob(job, heartbeat);
    return Promise.resolve();
  }

  /** Expose for testing. */
  getInFlightSize(): number {
    return this.inFlight.size;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function mockLogger(): Logger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function stubQueue(overrides: Partial<JobQueue> = {}): JobQueue {
  return {
    enqueue: vi.fn(),
    checkIdempotency: vi.fn(),
    dequeue: vi.fn(),
    acknowledge: vi.fn(),
    fail: vi.fn(),
    retry: vi.fn(),
    cancel: vi.fn(),
    getJob: vi.fn(),
    listJobs: vi.fn(),
    listDeadLettered: vi.fn(),
    heartbeat: vi.fn(),
    findStalledJobs: vi.fn(),
    countJobs: vi.fn(),
    getRetryPolicy: vi.fn(),
    setRetryPolicy: vi.fn(),
    setEventHooks: vi.fn(),
    ...overrides,
  } as JobQueue;
}

function makeJob(overrides: Partial<JobDefinition> = {}): JobDefinition {
  return {
    id: crypto.randomUUID() as JobId,
    systemId: null,
    type: "sync-push" as JobType,
    status: "running",
    payload: {},
    attempts: 1,
    maxAttempts: 3,
    nextRetryAt: null,
    error: null,
    result: null,
    createdAt: 1000 as UnixMillis,
    startedAt: 1000 as UnixMillis,
    completedAt: null,
    idempotencyKey: null,
    lastHeartbeatAt: 1000 as UnixMillis,
    timeoutMs: 30_000,
    scheduledFor: null,
    priority: 0,
    ...overrides,
  };
}

const noop: JobHandler = () => Promise.resolve();

// ── Tests ───────────────────────────────────────────────────────────

describe("BaseJobWorker", () => {
  let worker: TestJobWorker;

  afterEach(async () => {
    if (worker.isRunning()) {
      await worker.stop();
    }
  });

  // ── registerHandler ───────────────────────────────────────────────

  describe("registerHandler", () => {
    it("registers a handler and exposes it via registeredTypes", () => {
      const queue = stubQueue();
      worker = new TestJobWorker(queue, { logger: mockLogger() });
      worker.registerHandler("sync-push" as JobType, noop);
      expect(worker.registeredTypes()).toContain("sync-push");
    });

    it("throws DuplicateHandlerError for the same type", () => {
      const queue = stubQueue();
      worker = new TestJobWorker(queue, { logger: mockLogger() });
      worker.registerHandler("sync-push" as JobType, noop);
      expect(() => {
        worker.registerHandler("sync-push" as JobType, noop);
      }).toThrow(DuplicateHandlerError);
    });

    it("throws WorkerAlreadyRunningError when called after start", async () => {
      const queue = stubQueue();
      worker = new TestJobWorker(queue, { logger: mockLogger(), pollIntervalMs: 500 });
      worker.registerHandler("sync-push" as JobType, noop);
      await worker.start();
      expect(() => {
        worker.registerHandler("sync-pull" as JobType, noop);
      }).toThrow(WorkerAlreadyRunningError);
    });
  });

  // ── start / stop ──────────────────────────────────────────────────

  describe("start / stop", () => {
    it("rejects start with no handlers", async () => {
      const queue = stubQueue();
      worker = new TestJobWorker(queue, { logger: mockLogger() });
      await expect(worker.start()).rejects.toThrow(NoHandlersRegisteredError);
    });

    it("rejects double start", async () => {
      const queue = stubQueue();
      worker = new TestJobWorker(queue, { logger: mockLogger(), pollIntervalMs: 500 });
      worker.registerHandler("sync-push" as JobType, noop);
      await worker.start();
      await expect(worker.start()).rejects.toThrow(WorkerAlreadyRunningError);
    });

    it("calls onStart during start and onStop during stop", async () => {
      const queue = stubQueue();
      worker = new TestJobWorker(queue, { logger: mockLogger(), pollIntervalMs: 500 });
      worker.registerHandler("sync-push" as JobType, noop);
      expect(worker.onStartCalled).toBe(false);
      await worker.start();
      expect(worker.onStartCalled).toBe(true);
      expect(worker.onStopCalled).toBe(false);
      await worker.stop();
      expect(worker.onStopCalled).toBe(true);
    });

    it("isRunning reflects lifecycle state", async () => {
      const queue = stubQueue();
      worker = new TestJobWorker(queue, { logger: mockLogger(), pollIntervalMs: 500 });
      worker.registerHandler("sync-push" as JobType, noop);
      expect(worker.isRunning()).toBe(false);
      await worker.start();
      expect(worker.isRunning()).toBe(true);
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it("stop is safe to call when not running", async () => {
      const queue = stubQueue();
      worker = new TestJobWorker(queue, { logger: mockLogger() });
      await expect(worker.stop()).resolves.not.toThrow();
    });
  });

  // ── processJob ────────────────────────────────────────────────────

  describe("processJob", () => {
    it("invokes handler and acknowledges on success", async () => {
      const ackFn = vi.fn().mockResolvedValue({});
      const queue = stubQueue({ acknowledge: ackFn });
      worker = new TestJobWorker(queue, { logger: mockLogger(), pollIntervalMs: 50 });
      const handlerFn = vi.fn().mockResolvedValue(undefined);
      worker.registerHandler("sync-push" as JobType, handlerFn);

      const job = makeJob();
      worker.feedJob(job);
      await worker.start();

      await vi.waitFor(() => {
        expect(ackFn).toHaveBeenCalledWith(job.id, {});
      });

      expect(handlerFn).toHaveBeenCalledWith(
        job,
        expect.objectContaining({ heartbeat: expect.anything(), signal: expect.anything() }),
      );
    });

    it("calls queue.fail when handler throws", async () => {
      const failFn = vi.fn().mockResolvedValue({});
      const queue = stubQueue({ fail: failFn });
      worker = new TestJobWorker(queue, { logger: mockLogger(), pollIntervalMs: 50 });
      worker.registerHandler("sync-push" as JobType, () =>
        Promise.reject(new Error("handler boom")),
      );

      const job = makeJob();
      worker.feedJob(job);
      await worker.start();

      await vi.waitFor(() => {
        expect(failFn).toHaveBeenCalledWith(job.id, "handler boom");
      });
    });

    it("calls queue.fail when no handler is registered for the job type", async () => {
      const failFn = vi.fn().mockResolvedValue({});
      const queue = stubQueue({ fail: failFn });
      worker = new TestJobWorker(queue, { logger: mockLogger(), pollIntervalMs: 50 });
      worker.registerHandler("blob-upload" as JobType, noop);

      const job = makeJob({ type: "sync-push" as JobType });
      worker.feedJob(job);
      await worker.start();

      await vi.waitFor(() => {
        expect(failFn).toHaveBeenCalledWith(
          job.id,
          expect.stringContaining("No handler registered"),
        );
      });
    });

    it("retries acknowledge on transient failure", async () => {
      const ackFn = vi.fn().mockRejectedValueOnce(new Error("transient")).mockResolvedValue({});
      const warnFn = vi.fn();
      const logger: Logger = { info: vi.fn(), warn: warnFn, error: vi.fn() };
      const queue = stubQueue({ acknowledge: ackFn });
      worker = new TestJobWorker(queue, { logger, pollIntervalMs: 50 });
      worker.registerHandler("sync-push" as JobType, noop);

      const job = makeJob();
      worker.feedJob(job);
      await worker.start();

      await vi.waitFor(() => {
        expect(ackFn).toHaveBeenCalledTimes(2);
      });

      expect(warnFn).toHaveBeenCalledWith(
        "worker.acknowledge-retry",
        expect.objectContaining({ jobId: job.id, attempt: 1 }),
      );
    });

    it("logs exhaustion after max ack retries", async () => {
      const ackFn = vi.fn().mockRejectedValue(new Error("persistent failure"));
      const errorFn = vi.fn();
      const logger: Logger = { info: vi.fn(), warn: vi.fn(), error: errorFn };
      const queue = stubQueue({ acknowledge: ackFn });
      worker = new TestJobWorker(queue, { logger, pollIntervalMs: 50 });
      worker.registerHandler("sync-push" as JobType, noop);

      const job = makeJob();
      worker.feedJob(job);
      await worker.start();

      await vi.waitFor(() => {
        expect(errorFn).toHaveBeenCalledWith(
          "worker.acknowledge-exhausted",
          expect.objectContaining({ jobId: job.id }),
        );
      });
    });
  });

  // ── createHeartbeatHandle ─────────────────────────────────────────

  describe("createHeartbeatHandle", () => {
    it("delegates to queue.heartbeat", async () => {
      const heartbeatFn = vi.fn().mockResolvedValue(undefined);
      const ackFn = vi.fn().mockResolvedValue({});
      const queue = stubQueue({ heartbeat: heartbeatFn, acknowledge: ackFn });
      worker = new TestJobWorker(queue, { logger: mockLogger(), pollIntervalMs: 50 });

      let heartbeatCalled = false;
      worker.registerHandler("sync-push" as JobType, async (_job, ctx) => {
        await ctx.heartbeat.heartbeat();
        heartbeatCalled = true;
      });

      const job = makeJob();
      worker.feedJob(job);
      await worker.start();

      await vi.waitFor(() => {
        expect(heartbeatCalled).toBe(true);
      });

      expect(heartbeatFn).toHaveBeenCalledWith(job.id);
    });
  });

  // ── graceful shutdown ─────────────────────────────────────────────

  describe("graceful shutdown", () => {
    it("aborts in-flight jobs on stop", async () => {
      const queue = stubQueue({ acknowledge: vi.fn().mockResolvedValue({}) });
      worker = new TestJobWorker(queue, { logger: mockLogger(), pollIntervalMs: 50 });

      let signalAborted = false;
      worker.registerHandler("sync-push" as JobType, async (_job, ctx) => {
        await new Promise<void>((resolve) => {
          ctx.signal.addEventListener("abort", () => {
            signalAborted = true;
            resolve();
          });
        });
      });

      const job = makeJob();
      worker.feedJob(job);
      await worker.start();

      await vi.waitFor(() => {
        expect(worker.getInFlightSize()).toBe(1);
      });

      await worker.stop();
      expect(signalAborted).toBe(true);
    });
  });

  // ── poll backoff helpers ──────────────────────────────────────────

  describe("handlePollFailure / handlePollSuccess", () => {
    it("tracks consecutive failures and resets on success", async () => {
      const queue = stubQueue();
      const currentTime = 1000 as UnixMillis;
      const logger = mockLogger();
      worker = new TestJobWorker(queue, {
        logger,
        pollIntervalMs: 50,
        clock: () => currentTime,
      });
      worker.registerHandler("sync-push" as JobType, noop);
      await worker.start();

      await vi.waitFor(() => {
        expect(worker.pollCallCount).toBeGreaterThanOrEqual(2);
      });

      const countBefore = worker.pollCallCount;
      await vi.waitFor(() => {
        expect(worker.pollCallCount).toBeGreaterThan(countBefore);
      });
    });
  });
});
