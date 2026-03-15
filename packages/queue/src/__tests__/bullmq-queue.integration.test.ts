import { afterAll, afterEach, describe, expect, it } from "vitest";

import { BullMQJobQueue } from "../adapters/bullmq/bullmq-job-queue.js";
import { BullMQJobWorker } from "../adapters/bullmq/bullmq-job-worker.js";

import { dequeueOrFail, makeJobParams } from "./helpers.js";
import { runJobQueueContract } from "./job-queue.contract.js";
import { runJobWorkerContract } from "./job-worker.contract.js";
import { ensureValkey } from "./valkey-container.js";

import type { ValkeyTestContext } from "./valkey-container.js";
import type { UnixMillis } from "@pluralscape/types";
import type IORedis from "ioredis";

// Resolve Valkey availability before any tests run
const ctx: ValkeyTestContext = await ensureValkey();
const redis: IORedis | null = ctx.redis;

let testId = 0;

function nextQueueName(): string {
  testId++;
  return `test-${String(Date.now())}-${String(testId)}`;
}

function createQueue(clock?: () => UnixMillis): BullMQJobQueue {
  if (redis === null) throw new Error("Valkey not available");
  return new BullMQJobQueue(nextQueueName(), redis, clock);
}

afterAll(async () => {
  await ctx.cleanup();
}, 10_000);

// ── Contract tests ─────────────────────────────────────────────────

// Track queues for cleanup
const activeQueues: BullMQJobQueue[] = [];

afterEach(async () => {
  for (const q of activeQueues) {
    try {
      await q.obliterate();
      await q.close();
    } catch (err) {
      console.error("Queue cleanup failed:", err);
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
      return new BullMQJobWorker(q.name, redis, { pollIntervalMs: 50 });
    },
  );
});

// ── BullMQ-specific tests ──────────────────────────────────────────

describe.skipIf(!ctx.available)("BullMQJobQueue-specific", () => {
  let queue: BullMQJobQueue | undefined;

  afterEach(async () => {
    if (queue !== undefined) {
      await queue.obliterate();
      await queue.close();
      queue = undefined;
    }
  });

  it("connects to Valkey and performs basic enqueue/dequeue", async () => {
    queue = createQueue();
    const job = await queue.enqueue(makeJobParams({ type: "sync-push" }));
    expect(job.status).toBe("pending");

    const dequeued = await queue.dequeue();
    expect(dequeued).not.toBeNull();
    expect(dequeued?.id).toBe(job.id);
    expect(dequeued?.status).toBe("running");
  });

  it("detects stalled jobs with injectable clock", async () => {
    let currentTime = 1000 as UnixMillis;
    queue = createQueue(() => currentTime);

    await queue.enqueue(makeJobParams({ timeoutMs: 5000 }));
    await queue.dequeue();

    currentTime = 7000 as UnixMillis;
    const stalled = await queue.findStalledJobs();
    expect(stalled).toHaveLength(1);
    expect(stalled[0]?.status).toBe("running");
  });

  it("handles idempotency key re-use after completion", async () => {
    queue = createQueue();
    const key = "reuse-key";
    await queue.enqueue(makeJobParams({ idempotencyKey: key }));
    const first = await dequeueOrFail(queue);
    await queue.acknowledge(first.id, {});

    const second = await queue.enqueue(makeJobParams({ idempotencyKey: key }));
    expect(second.status).toBe("pending");
    expect(second.id).not.toBe(first.id);
  });
});
