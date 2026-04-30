import { toUnixMillis } from "@pluralscape/types";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { BullMQJobQueue } from "../adapters/bullmq/bullmq-job-queue.js";
import { BullMQJobWorker } from "../adapters/bullmq/bullmq-job-worker.js";

import {
  createQueue,
  createTracking,
  ioredisRejectionHandler,
  mockLogger,
  teardownTracking,
} from "./helpers/bullmq-test-fixtures.js";
import { dequeueOrFail, makeJobParams } from "./helpers.js";
import { runJobQueueContract } from "./job-queue.contract.js";
import { runJobWorkerContract } from "./job-worker.contract.js";
import { ensureValkey } from "./valkey-container.js";

import type { ValkeyTestContext } from "./valkey-container.js";
import type IORedis from "ioredis";

process.on("unhandledRejection", ioredisRejectionHandler);

// Resolve Valkey availability before any tests run
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

// ── Contract tests ─────────────────────────────────────────────────

describe.skipIf(!ctx.available)("BullMQJobQueue", () => {
  runJobQueueContract(() => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    return q;
  });
});

describe.skipIf(!ctx.available)("BullMQJobWorker", () => {
  runJobWorkerContract(
    () => {
      const q = createQueue(redis);
      tracking.activeQueues.push(q);
      return q;
    },
    (queue) => {
      const q = queue as BullMQJobQueue;
      if (redis === null) throw new Error("Valkey not available");
      const worker = new BullMQJobWorker(q.name, redis, queue, {
        pollIntervalMs: 50,
        logger: mockLogger,
      });
      tracking.activeWorkers.push(worker);
      return worker;
    },
  );
});

// ── BullMQ-specific tests ──────────────────────────────────────────

describe.skipIf(!ctx.available)("BullMQJobQueue-specific", () => {
  it("connects to Valkey and performs basic enqueue/dequeue", async () => {
    const queue = createQueue(redis);
    tracking.activeQueues.push(queue);
    const job = await queue.enqueue(makeJobParams({ type: "sync-push" }));
    expect(job.status).toBe("pending");

    const dequeued = await queue.dequeue();
    expect(dequeued).not.toBeNull();
    expect(dequeued?.id).toBe(job.id);
    expect(dequeued?.status).toBe("running");
  });

  it("detects stalled jobs with injectable clock", async () => {
    let currentTime = toUnixMillis(1000);
    const queue = createQueue(redis, { clock: () => currentTime });
    tracking.activeQueues.push(queue);

    await queue.enqueue(makeJobParams({ timeoutMs: 5000 }));
    await queue.dequeue();

    currentTime = toUnixMillis(7000);
    const stalled = await queue.findStalledJobs();
    expect(stalled).toHaveLength(1);
    expect(stalled[0]?.status).toBe("running");
  });

  it("handles idempotency key re-use after completion", async () => {
    const queue = createQueue(redis);
    tracking.activeQueues.push(queue);
    const key = "reuse-key";
    await queue.enqueue(makeJobParams({ idempotencyKey: key }));
    const first = await dequeueOrFail(queue);
    await queue.acknowledge(first.id, {});

    const second = await queue.enqueue(makeJobParams({ idempotencyKey: key }));
    expect(second.status).toBe("pending");
    expect(second.id).not.toBe(first.id);
  });
});
