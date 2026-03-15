/**
 * Contract test suite for JobWorker implementations.
 *
 * Usage:
 *   import { runJobWorkerContract } from "./job-worker.contract.js";
 *   runJobWorkerContract(() => new YourJobQueue(), (queue) => new YourJobWorker(queue));
 *
 * The factory receives a fresh JobQueue and must return a JobWorker backed by it.
 */
import { describe, expect, it } from "vitest";

import {
  DuplicateHandlerError,
  NoHandlersRegisteredError,
  WorkerAlreadyRunningError,
} from "../errors.js";

import { makeJobParams } from "./helpers.js";

import type { JobQueue } from "../job-queue.js";
import type { JobHandlerContext } from "../job-worker.js";
import type { JobWorker } from "../job-worker.js";
import type { JobDefinition } from "@pluralscape/types";

const noop = (): Promise<void> => Promise.resolve();

export function runJobWorkerContract(
  queueFactory: () => JobQueue,
  workerFactory: (queue: JobQueue) => JobWorker,
): void {
  describe("JobWorker contract", () => {
    // ── 1. registerHandler before start ────────────────────────────

    describe("registerHandler", () => {
      it("registers a handler for a job type", () => {
        const queue = queueFactory();
        const worker = workerFactory(queue);
        expect(() => {
          worker.registerHandler("sync-push", noop);
        }).not.toThrow();
        expect(worker.registeredTypes()).toContain("sync-push");
      });

      it("throws DuplicateHandlerError when registering the same type twice", () => {
        const queue = queueFactory();
        const worker = workerFactory(queue);
        worker.registerHandler("sync-push", noop);
        expect(() => {
          worker.registerHandler("sync-push", noop);
        }).toThrow(DuplicateHandlerError);
      });
    });

    // ── 2. registerHandler after start throws ───────────────────────

    describe("registerHandler after start", () => {
      it("throws WorkerAlreadyRunningError", async () => {
        const queue = queueFactory();
        const worker = workerFactory(queue);
        worker.registerHandler("sync-push", noop);
        await worker.start();
        try {
          expect(() => {
            worker.registerHandler("sync-pull", noop);
          }).toThrow(WorkerAlreadyRunningError);
        } finally {
          await worker.stop();
        }
      });
    });

    // ── 3. start with no handlers throws ───────────────────────────

    describe("start with no handlers", () => {
      it("throws NoHandlersRegisteredError", async () => {
        const queue = queueFactory();
        const worker = workerFactory(queue);
        await expect(worker.start()).rejects.toThrow(NoHandlersRegisteredError);
      });
    });

    // ── 4. start / stop lifecycle ───────────────────────────────────

    describe("start / stop lifecycle", () => {
      it("isRunning returns true after start and false after stop", async () => {
        const queue = queueFactory();
        const worker = workerFactory(queue);
        worker.registerHandler("sync-push", noop);
        expect(worker.isRunning()).toBe(false);
        await worker.start();
        expect(worker.isRunning()).toBe(true);
        await worker.stop();
        expect(worker.isRunning()).toBe(false);
      });

      it("throws WorkerAlreadyRunningError on double start", async () => {
        const queue = queueFactory();
        const worker = workerFactory(queue);
        worker.registerHandler("sync-push", noop);
        await worker.start();
        try {
          await expect(worker.start()).rejects.toThrow(WorkerAlreadyRunningError);
        } finally {
          await worker.stop();
        }
      });
    });

    // ── 5. registeredTypes ──────────────────────────────────────────

    describe("registeredTypes", () => {
      it("returns all registered job types", () => {
        const queue = queueFactory();
        const worker = workerFactory(queue);
        worker.registerHandler("sync-push", noop);
        worker.registerHandler("blob-upload", noop);
        expect(worker.registeredTypes()).toContain("sync-push");
        expect(worker.registeredTypes()).toContain("blob-upload");
        expect(worker.registeredTypes()).toHaveLength(2);
      });

      it("returns empty array before any handlers are registered", () => {
        const queue = queueFactory();
        const worker = workerFactory(queue);
        expect(worker.registeredTypes()).toHaveLength(0);
      });
    });

    // ── 6. Handler invoked with correct job and context ─────────────

    describe("handler invocation", () => {
      it("invokes the handler with the job and a context object", async () => {
        const queue = queueFactory();
        const worker = workerFactory(queue);
        const captured: {
          job: JobDefinition | null;
          ctx: JobHandlerContext | null;
        } = { job: null, ctx: null };

        worker.registerHandler("sync-push", (job, ctx) => {
          captured.job = job;
          captured.ctx = ctx;
          return Promise.resolve();
        });
        await worker.start();

        const job = await queue.enqueue(makeJobParams({ type: "sync-push" }));
        await waitFor(async () => {
          const j = await queue.getJob(job.id);
          return j?.status === "completed";
        });
        await worker.stop();

        expect(captured.job).not.toBeNull();
        expect(captured.job?.id).toBe(job.id);
        expect(captured.ctx?.heartbeat).toBeDefined();
        expect(captured.ctx?.signal).toBeDefined();
      });
    });

    // ── 7. Heartbeat works in handler ───────────────────────────────

    describe("heartbeat in handler", () => {
      it("does not throw when called from a handler", async () => {
        const queue = queueFactory();
        const worker = workerFactory(queue);
        let heartbeatError: unknown = null;

        worker.registerHandler("sync-push", async (_, ctx) => {
          try {
            await ctx.heartbeat.heartbeat();
          } catch (err) {
            heartbeatError = err;
          }
        });
        await worker.start();

        const job = await queue.enqueue(makeJobParams({ type: "sync-push" }));
        await waitFor(async () => {
          const j = await queue.getJob(job.id);
          return j?.status === "completed";
        });
        await worker.stop();

        expect(heartbeatError).toBeNull();
      });
    });

    // ── 8. Graceful shutdown via signal ─────────────────────────────

    describe("graceful shutdown signal", () => {
      it("aborts the signal when stop() is called while a handler is running", async () => {
        const queue = queueFactory();
        const worker = workerFactory(queue);
        const capture: { signal: AbortSignal | null } = { signal: null };

        worker.registerHandler("sync-push", async (_, ctx) => {
          capture.signal = ctx.signal;
          await new Promise<void>((resolve) => {
            ctx.signal.addEventListener("abort", () => {
              resolve();
            });
          });
        });
        await worker.start();

        await queue.enqueue(makeJobParams({ type: "sync-push" }));
        await delay(100);
        await worker.stop();

        expect(capture.signal).not.toBeNull();
        expect(capture.signal?.aborted).toBe(true);
      });
    });

    // ── 9. Handler throw → queue.fail() ────────────────────────────

    describe("handler failure", () => {
      it("calls queue.fail() when handler throws", async () => {
        const queue = queueFactory();
        const worker = workerFactory(queue);
        worker.registerHandler("sync-push", () => Promise.reject(new Error("handler exploded")));
        await worker.start();

        const job = await queue.enqueue(makeJobParams({ type: "sync-push", maxAttempts: 1 }));
        await waitFor(async () => {
          const j = await queue.getJob(job.id);
          return j?.status === "dead-letter" || j?.status === "failed";
        });
        await worker.stop();

        const finalJob = await queue.getJob(job.id);
        expect(["failed", "dead-letter"]).toContain(finalJob?.status);
        expect(finalJob?.error).toContain("handler exploded");
      });
    });

    // ── 10. Double stop is safe ─────────────────────────────────────

    describe("double stop", () => {
      it("does not throw when stop() is called on a stopped worker", async () => {
        const queue = queueFactory();
        const worker = workerFactory(queue);
        worker.registerHandler("sync-push", noop);
        await worker.start();
        await worker.stop();
        await expect(worker.stop()).resolves.not.toThrow();
      });
    });
  });
}

// ── Test utilities ──────────────────────────────────────────────────

async function waitFor(
  predicate: () => Promise<boolean>,
  { timeoutMs = 3000, intervalMs = 50 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(intervalMs);
  }
  throw new Error(`waitFor timed out after ${String(timeoutMs)}ms`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
