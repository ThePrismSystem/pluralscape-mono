import { afterAll, afterEach, describe, expect, it } from "vitest";

import { BullMQJobQueue } from "../adapters/bullmq/bullmq-job-queue.js";
import { BullMQJobWorker } from "../adapters/bullmq/bullmq-job-worker.js";
import { createValkeyConnection } from "../adapters/bullmq/connection.js";

import {
  createQueue,
  createTracking,
  ioredisRejectionHandler,
  mockLogger,
  nextQueueName,
  teardownTracking,
  VALKEY_TEST_PORT,
  waitFor,
} from "./helpers/bullmq-test-fixtures.js";
import { makeJobParams } from "./helpers.js";
import { ensureValkey } from "./valkey-container.js";

import type { ValkeyTestContext } from "./valkey-container.js";
import type IORedis from "ioredis";

process.on("unhandledRejection", ioredisRejectionHandler);

const ctx: ValkeyTestContext = await ensureValkey();
const redis: IORedis | null = ctx.redis;

const tracking = createTracking();

afterAll(async () => {
  await ctx.cleanup();
  process.removeListener("unhandledRejection", ioredisRejectionHandler);
}, 10_000);

afterEach(async () => {
  await teardownTracking(tracking);
}, 10_000);

// ── bullmq-job-worker.ts uncovered branches ───────────────────────

describe.skipIf(!ctx.available)("BullMQJobWorker — branch coverage", () => {
  // ── onStop: normal lifecycle — worker set in onStart, cleared in onStop finally ──

  it("stop after start-and-stop cleans up the internal BullMQ worker", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");
    const worker = new BullMQJobWorker(q.name, redis, q, {
      pollIntervalMs: 200,
      logger: mockLogger,
    });
    tracking.activeWorkers.push(worker);
    worker.registerHandler("sync-push", () => Promise.resolve());
    await worker.start();
    expect(worker.isRunning()).toBe(true);
    await worker.stop();
    expect(worker.isRunning()).toBe(false);
    // Second stop is a no-op (BaseJobWorker returns early) — safe to call
    await expect(worker.stop()).resolves.not.toThrow();
  });

  // ── onStart: db option set — covers the `db !== undefined` spread branch ──

  it("worker starts with db option set in connection", async () => {
    if (redis === null) throw new Error("Valkey not available");
    const connWithDb = createValkeyConnection({ host: "localhost", port: VALKEY_TEST_PORT, db: 0 });
    const q2 = new BullMQJobQueue(nextQueueName(), connWithDb, { logger: mockLogger });
    tracking.activeQueues.push(q2);
    const worker = new BullMQJobWorker(q2.name, connWithDb, q2, {
      pollIntervalMs: 200,
      logger: mockLogger,
    });
    tracking.activeWorkers.push(worker);
    worker.registerHandler("sync-push", () => Promise.resolve());
    await worker.start();
    expect(worker.isRunning()).toBe(true);
    await worker.stop();
    await connWithDb.quit();
  });

  // ── poll: shouldSkipPoll() true branch — call poll() directly after stop ──

  it("poll() returns immediately when shouldSkipPoll() is true (running=false)", async () => {
    if (redis === null) throw new Error("Valkey not available");
    const q = createQueue(redis);
    tracking.activeQueues.push(q);

    // Subclass that exposes the protected poll() method
    class PollableWorker extends BullMQJobWorker {
      async triggerPoll(): Promise<void> {
        await this.poll();
      }
    }

    const worker = new PollableWorker(q.name, redis, q, {
      pollIntervalMs: 5000,
      logger: mockLogger,
    });
    tracking.activeWorkers.push(worker);
    worker.registerHandler("sync-push", () => Promise.resolve());
    await worker.start();
    await worker.stop();
    // running=false now — poll() hits shouldSkipPoll() true branch and returns early
    await expect(worker.triggerPoll()).resolves.not.toThrow();
  });

  // ── onStop: worker===null branch — call onStop again via subclass after first stop ──

  it("onStop is a no-op when internal BullMQ worker is already null", async () => {
    if (redis === null) throw new Error("Valkey not available");
    const q = createQueue(redis);
    tracking.activeQueues.push(q);

    // Subclass that exposes the protected onStop() method
    class StoppableWorker extends BullMQJobWorker {
      async triggerOnStop(): Promise<void> {
        await this.onStop();
      }
    }

    const worker = new StoppableWorker(q.name, redis, q, {
      pollIntervalMs: 5000,
      logger: mockLogger,
    });
    tracking.activeWorkers.push(worker);
    worker.registerHandler("sync-push", () => Promise.resolve());
    await worker.start();
    // First stop: sets this.worker = null in finally block
    await worker.stop();
    // Second direct onStop() call: this.worker is null → hits the false branch of the if-guard
    await expect(worker.triggerOnStop()).resolves.not.toThrow();
  });

  // ── poll: runs and picks up a job (normal happy path) ──

  it("worker processes a job end-to-end and marks it completed", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");
    const worker = new BullMQJobWorker(q.name, redis, q, {
      pollIntervalMs: 50,
      logger: mockLogger,
    });
    tracking.activeWorkers.push(worker);
    worker.registerHandler("sync-push", () => Promise.resolve());
    await worker.start();

    const job = await q.enqueue(makeJobParams({ type: "sync-push" }));

    await waitFor(async () => {
      const j = await q.getJob(job.id);
      return j?.status === "completed";
    });

    await worker.stop();
    const final = await q.getJob(job.id);
    expect(final?.status).toBe("completed");
  });

  // ── processBullMQJob: handler throws → queue.fail called ──

  it("worker calls queue.fail when handler throws", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");
    const worker = new BullMQJobWorker(q.name, redis, q, {
      pollIntervalMs: 50,
      logger: mockLogger,
    });
    tracking.activeWorkers.push(worker);
    worker.registerHandler("sync-push", () => {
      throw new Error("handler-error");
    });
    await worker.start();

    const job = await q.enqueue(makeJobParams({ type: "sync-push" }));

    await waitFor(async () => {
      const j = await q.getJob(job.id);
      return j?.status === "dead-letter" || j?.status === "pending";
    });

    await worker.stop();
    const final = await q.getJob(job.id);
    expect(["dead-letter", "pending"]).toContain(final?.status);
  });
});
