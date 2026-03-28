import { toUnixMillis } from "@pluralscape/types";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { BullMQJobQueue } from "../adapters/bullmq/bullmq-job-queue.js";
import { BullMQJobWorker } from "../adapters/bullmq/bullmq-job-worker.js";

import { dequeueOrFail, makeJobParams } from "./helpers.js";
import { runJobQueueContract } from "./job-queue.contract.js";
import { runJobWorkerContract } from "./job-worker.contract.js";
import { ensureValkey } from "./valkey-container.js";

import type { ValkeyTestContext } from "./valkey-container.js";
import type { Logger, UnixMillis } from "@pluralscape/types";
import type IORedis from "ioredis";

// Safety net: BullMQ's Worker creates a private blockingConnection whose
// teardown can produce unhandled "Connection is closed" rejections from ioredis
// when close() races with connection initialization. This handler catches only
// that specific ioredis error and is scoped to this test file's process.
const ioredisRejectionHandler = (reason: unknown): void => {
  if (reason instanceof Error && reason.message === "Connection is closed.") {
    return;
  }
  // Throwing inside an unhandledRejection handler re-raises as an uncaught
  // exception, which Vitest will still catch as a test failure.
  throw reason;
};
process.on("unhandledRejection", ioredisRejectionHandler);

const mockLogger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

// Resolve Valkey availability before any tests run
const ctx: ValkeyTestContext = await ensureValkey();
const redis: IORedis | null = ctx.redis;

let testId = 0;

function nextQueueName(): string {
  testId++;
  return `test-${String(Date.now())}-${String(testId)}`;
}

function createQueue(options?: { clock?: () => UnixMillis; logger?: Logger }): BullMQJobQueue {
  if (redis === null) throw new Error("Valkey not available");
  return new BullMQJobQueue(nextQueueName(), redis, {
    logger: options?.logger ?? mockLogger,
    clock: options?.clock,
  });
}

afterAll(async () => {
  await ctx.cleanup();
  process.removeListener("unhandledRejection", ioredisRejectionHandler);
}, 10_000);

// ── Contract tests ─────────────────────────────────────────────────

// Track queues and workers for cleanup
const activeQueues: BullMQJobQueue[] = [];
const activeWorkers: BullMQJobWorker[] = [];

afterEach(async () => {
  for (const w of activeWorkers) {
    try {
      if (w.isRunning()) await w.stop();
    } catch (err) {
      mockLogger.warn("teardown", { error: String(err) });
    }
  }
  activeWorkers.length = 0;

  for (const q of activeQueues) {
    try {
      await q.obliterate();
    } catch (err) {
      mockLogger.warn("teardown", { error: String(err) });
    }
    try {
      await q.close();
    } catch (err) {
      mockLogger.warn("teardown", { error: String(err) });
    }
  }
  activeQueues.length = 0;
}, 10_000);

describe.skipIf(!ctx.available)("BullMQJobQueue", () => {
  runJobQueueContract(() => {
    const q = createQueue();
    activeQueues.push(q);
    return q;
  });
});

describe.skipIf(!ctx.available)("BullMQJobWorker", () => {
  runJobWorkerContract(
    () => {
      const q = createQueue();
      activeQueues.push(q);
      return q;
    },
    (queue) => {
      const q = queue as BullMQJobQueue;
      if (redis === null) throw new Error("Valkey not available");
      const worker = new BullMQJobWorker(q.name, redis, queue, {
        pollIntervalMs: 50,
        logger: mockLogger,
      });
      activeWorkers.push(worker);
      return worker;
    },
  );
});

// ── BullMQ-specific tests ──────────────────────────────────────────

describe.skipIf(!ctx.available)("BullMQJobQueue-specific", () => {
  let queue: BullMQJobQueue | undefined;

  afterEach(() => {
    queue = undefined;
  });

  it("connects to Valkey and performs basic enqueue/dequeue", async () => {
    queue = createQueue();
    activeQueues.push(queue);
    const job = await queue.enqueue(makeJobParams({ type: "sync-push" }));
    expect(job.status).toBe("pending");

    const dequeued = await queue.dequeue();
    expect(dequeued).not.toBeNull();
    expect(dequeued?.id).toBe(job.id);
    expect(dequeued?.status).toBe("running");
  });

  it("detects stalled jobs with injectable clock", async () => {
    let currentTime = toUnixMillis(1000);
    queue = createQueue({ clock: () => currentTime });
    activeQueues.push(queue);

    await queue.enqueue(makeJobParams({ timeoutMs: 5000 }));
    await queue.dequeue();

    currentTime = toUnixMillis(7000);
    const stalled = await queue.findStalledJobs();
    expect(stalled).toHaveLength(1);
    expect(stalled[0]?.status).toBe("running");
  });

  it("handles idempotency key re-use after completion", async () => {
    queue = createQueue();
    activeQueues.push(queue);
    const key = "reuse-key";
    await queue.enqueue(makeJobParams({ idempotencyKey: key }));
    const first = await dequeueOrFail(queue);
    await queue.acknowledge(first.id, {});

    const second = await queue.enqueue(makeJobParams({ idempotencyKey: key }));
    expect(second.status).toBe("pending");
    expect(second.id).not.toBe(first.id);
  });
});
