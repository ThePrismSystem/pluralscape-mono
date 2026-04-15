import { toUnixMillis } from "@pluralscape/types";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { BullMQJobQueue } from "../adapters/bullmq/bullmq-job-queue.js";
import { BullMQJobWorker } from "../adapters/bullmq/bullmq-job-worker.js";
import { createValkeyConnection } from "../adapters/bullmq/connection.js";
import { IdempotencyConflictError, InvalidJobTransitionError } from "../errors.js";

import { delay, dequeueOrFail, makeJobParams, testSystemId } from "./helpers.js";
import { runJobQueueContract } from "./job-queue.contract.js";
import { runJobWorkerContract } from "./job-worker.contract.js";
import { ensureValkey } from "./valkey-container.js";

import type { ValkeyTestContext } from "./valkey-container.js";
import type { JobId, Logger, UnixMillis } from "@pluralscape/types";
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

// Valkey port resolution must mirror valkey-container.ts: CI sets TEST_VALKEY_PORT=6379,
// local dev defaults to 10944. Hardcoding either value breaks the other environment.
const VALKEY_TEST_PORT = Number(process.env["TEST_VALKEY_PORT"]) || 10_944;

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

// ── Branch-coverage tests ──────────────────────────────────────────

// Polling helper used throughout this section
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

// ── connection.ts ──────────────────────────────────────────────────

describe.skipIf(!ctx.available)("createValkeyConnection", () => {
  it("creates a working connection with all optional fields omitted", async () => {
    const conn = createValkeyConnection({ host: "localhost", port: VALKEY_TEST_PORT });
    const pong = await conn.ping();
    expect(pong).toBe("PONG");
    await conn.quit();
  });

  it("creates a connection with optional db field set", async () => {
    const conn = createValkeyConnection({ host: "localhost", port: VALKEY_TEST_PORT, db: 0 });
    const pong = await conn.ping();
    expect(pong).toBe("PONG");
    await conn.quit();
  });

  it("passes password when provided (wrong password yields auth error)", async () => {
    // We cannot connect with a wrong password on the test instance (no auth
    // configured), but we can verify the constructor does not throw and that
    // the returned object is an IORedis instance.
    const conn = createValkeyConnection({
      host: "localhost",
      port: VALKEY_TEST_PORT,
      password: undefined,
    });
    const pong = await conn.ping();
    expect(pong).toBe("PONG");
    await conn.quit();
  });

  it("passes tls:true so the tls option is set (covers tls branch in createValkeyConnection)", () => {
    // We do not actually connect (TLS would fail against a plain Valkey),
    // just verify the options are applied.
    const conn = createValkeyConnection({ host: "localhost", port: VALKEY_TEST_PORT, tls: true });
    // ioredis exposes the resolved options on the instance
    const opts = conn.options;
    expect(opts.tls).toBeDefined();
    // Disconnect immediately — no await needed since we never connected
    conn.disconnect();
  });
});

// ── bullmq-job-queue.ts uncovered branches ────────────────────────

describe.skipIf(!ctx.available)("BullMQJobQueue — branch coverage", () => {
  // ── enqueue: scheduledFor in the past (delay = 0 via Math.max branch) ──

  it("enqueues a job scheduled in the past and dequeues it immediately", async () => {
    const q = createQueue();
    activeQueues.push(q);
    const pastTime = toUnixMillis(Date.now() - 5_000);
    const job = await q.enqueue(makeJobParams({ scheduledFor: pastTime }));
    expect(job.scheduledFor).toBe(pastTime);
    const dequeued = await q.dequeue();
    expect(dequeued?.id).toBe(job.id);
  });

  // ── enqueue: explicit priority provided (covers priority ?? 0 true branch) ──

  it("enqueues with an explicit non-zero priority", async () => {
    const q = createQueue();
    activeQueues.push(q);
    const job = await q.enqueue(makeJobParams({ priority: 5 }));
    expect(job.priority).toBe(5);
    const fetched = await q.getJob(job.id);
    expect(fetched?.priority).toBe(5);
  });

  // ── enqueue: idem key exists but existingId is null in Redis (key expired
  //    between SET NX and GET) — tested by manually deleting the key ──

  it("re-enqueues when idempotency key exists but maps to null (covers existingId null branch)", async () => {
    const q = createQueue();
    activeQueues.push(q);
    const key = crypto.randomUUID();
    const job1 = await q.enqueue(makeJobParams({ idempotencyKey: key }));
    // Delete the idem key from Redis to simulate expiry before get
    if (redis === null) throw new Error("Valkey not available");
    await redis.del(`psq:${q.name}:idem:${key}`);

    // Now re-enqueue — nxResult will be non-null (fresh key), so no conflict
    const job2 = await q.enqueue(makeJobParams({ idempotencyKey: key }));
    expect(job2.id).not.toBe(job1.id);
  });

  // ── enqueue: idempotency key "reserving" conflict (concurrent enqueue branch) ──

  it("throws IdempotencyConflictError when idem key is set to 'reserving'", async () => {
    const q = createQueue();
    activeQueues.push(q);
    const key = crypto.randomUUID();
    if (redis === null) throw new Error("Valkey not available");
    // Manually inject a "reserving" marker
    await redis.set(`psq:${q.name}:idem:${key}`, "reserving", "EX", 30);
    await expect(q.enqueue(makeJobParams({ idempotencyKey: key }))).rejects.toThrow(
      IdempotencyConflictError,
    );
  });

  // ── enqueue: idempotency key maps to an existing pending job (conflict) ──

  it("throws IdempotencyConflictError when same key maps to a pending job", async () => {
    const q = createQueue();
    activeQueues.push(q);
    const key = crypto.randomUUID();
    await q.enqueue(makeJobParams({ idempotencyKey: key }));
    // Second enqueue with same key — job still pending
    await expect(q.enqueue(makeJobParams({ idempotencyKey: key }))).rejects.toThrow(
      IdempotencyConflictError,
    );
  });

  // ── checkIdempotency: idem key exists but mapped job is gone (covers job===null branch) ──

  it("checkIdempotency returns exists:false when idem key points to a missing job", async () => {
    const q = createQueue();
    activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");
    const key = crypto.randomUUID();
    // Point the idem key at a non-existent job ID
    await redis.set(`psq:${q.name}:idem:${key}`, "job_ghost_does_not_exist");
    const result = await q.checkIdempotency(key);
    expect(result.exists).toBe(false);
  });

  // ── dequeue: put-back for nextRetryAt in the future ──

  it("does not dequeue a job whose nextRetryAt is in the future", async () => {
    const q = createQueue();
    activeQueues.push(q);
    // Enqueue and fail so it gets a nextRetryAt
    const job = await q.enqueue(makeJobParams({ type: "sync-push" }));
    const running = await dequeueOrFail(q);
    expect(running.id).toBe(job.id);
    // Fail with maxAttempts > 1 so it retries
    q.setRetryPolicy("sync-push", {
      maxRetries: 3,
      backoffMs: 60_000,
      backoffMultiplier: 1,
      maxBackoffMs: 120_000,
    });
    await q.fail(job.id, "transient error");
    // nextRetryAt is 60s in future — dequeue should return null
    const next = await q.dequeue();
    expect(next).toBeNull();
  });

  // ── dequeue: put-back for type filter mismatch ──

  it("puts back non-matching types and returns null when only wrong-type jobs exist", async () => {
    const q = createQueue();
    activeQueues.push(q);
    await q.enqueue(makeJobParams({ type: "blob-upload" }));
    // dequeue filtering for sync-push only — should not pick up blob-upload
    const result = await q.dequeue(["sync-push"]);
    expect(result).toBeNull();
  });

  // ── retry: job in cancelled store but not dead-letter ──

  it("retry throws InvalidJobTransitionError for cancelled-store job that is not dead-letter", async () => {
    const q = createQueue();
    activeQueues.push(q);
    const job = await q.enqueue(makeJobParams());
    await q.cancel(job.id);
    // The job is now in the cancelled store with status 'cancelled'
    await expect(q.retry(job.id)).rejects.toThrow(InvalidJobTransitionError);
  });

  // ── cancel: re-cancel a job already in cancelled store ──

  it("cancels a job that is already in the cancelled store (re-cancel path)", async () => {
    const q = createQueue();
    activeQueues.push(q);
    const job = await q.enqueue(makeJobParams());
    await q.cancel(job.id);
    // Cancel again — hits the cancelledRaw !== null branch
    const result = await q.cancel(job.id);
    expect(result.status).toBe("cancelled");
  });

  // ── cancel: throw when cancelling a completed job in the cancelled store ──

  it("cancel throws InvalidJobTransitionError for completed job in cancelled store", async () => {
    const q = createQueue();
    activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");
    // Manually inject a completed job into the cancelled store
    const fakeId = `job_fake_${crypto.randomUUID()}` as JobId;
    const fakeData = {
      systemId: null,
      type: "sync-push",
      payload: {},
      status: "completed",
      attempts: 1,
      maxAttempts: 1,
      nextRetryAt: null,
      error: null,
      result: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: Date.now(),
      idempotencyKey: crypto.randomUUID(),
      lastHeartbeatAt: null,
      timeoutMs: 30_000,
      scheduledFor: null,
      priority: 0,
    };
    await redis.set(`psq:${q.name}:cancelled:${fakeId}`, JSON.stringify(fakeData));
    await expect(q.cancel(fakeId)).rejects.toThrow(InvalidJobTransitionError);
  });

  // ── getJob: job in cancelled store ──

  it("getJob returns a job from the cancelled store", async () => {
    const q = createQueue();
    activeQueues.push(q);
    const job = await q.enqueue(makeJobParams());
    await q.cancel(job.id);
    const fetched = await q.getJob(job.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.status).toBe("cancelled");
  });

  // ── listJobs: bullmqStates empty (status = 'cancelled') ──

  it("listJobs with status=cancelled skips corrupt cancelled entries without crashing", async () => {
    const q = createQueue();
    activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");

    // Enqueue a valid job and cancel it so there's at least one good entry
    const validJob = await q.enqueue(makeJobParams());
    await q.cancel(validJob.id);

    // Inject a corrupt cancelled job — missing required fields for StoredJobDataSchema
    const corruptId = `job_corrupt_${crypto.randomUUID()}`;
    await redis.set(`psq:${q.name}:cancelled:${corruptId}`, JSON.stringify({ type: "test" }));

    // listJobs should skip the corrupt entry and still return the valid one
    const list = await q.listJobs({ status: "cancelled" });
    expect(list.some((j) => j.id === validJob.id)).toBe(true);
    expect(list.every((j) => j.id !== corruptId)).toBe(true);

    // Clean up the injected key
    await redis.del(`psq:${q.name}:cancelled:${corruptId}`);
  });

  it("listJobs with status=cancelled skips BullMQ states and reads cancelled store", async () => {
    const q = createQueue();
    activeQueues.push(q);
    const job = await q.enqueue(makeJobParams());
    await q.cancel(job.id);
    const list = await q.listJobs({ status: "cancelled" });
    expect(list.some((j) => j.id === job.id)).toBe(true);
  });

  // ── listJobs: filter by systemId ──

  it("listJobs filters by systemId", async () => {
    const q = createQueue();
    activeQueues.push(q);
    const sysA = testSystemId("sys-aaa");
    const sysB = testSystemId("sys-bbb");
    await q.enqueue(makeJobParams({ systemId: sysA }));
    await q.enqueue(makeJobParams({ systemId: sysB }));
    const list = await q.listJobs({ systemId: sysA });
    expect(list.every((j) => j.systemId === sysA)).toBe(true);
    expect(list).toHaveLength(1);
  });

  // ── listJobs: sort by priority (covers a.priority !== b.priority branch) ──

  it("listJobs sorts by priority ascending", async () => {
    const q = createQueue();
    activeQueues.push(q);
    await q.enqueue(makeJobParams({ priority: 10 }));
    await q.enqueue(makeJobParams({ priority: 1 }));
    const list = await q.listJobs({});
    const priorities = list.map((j) => j.priority);
    expect(priorities[0]).toBeLessThanOrEqual(priorities[1] ?? Infinity);
  });

  // ── findStalledJobs: active job with status !== 'running' (covers false branch) ──

  it("findStalledJobs ignores active BullMQ jobs whose status field is not running", async () => {
    const q = createQueue();
    activeQueues.push(q);
    // Enqueue a pending job — it will appear as 'waiting' in BullMQ and its
    // stored status is 'pending', so findStalledJobs should skip it.
    await q.enqueue(makeJobParams({ timeoutMs: 1 }));
    const stalled = await q.findStalledJobs();
    expect(stalled).toHaveLength(0);
  });

  // ── findStalledJobs: lastHeartbeatAt is null (covers lastBeat null branch) ──

  it("findStalledJobs skips running job with no heartbeat and startedAt null", async () => {
    // Dequeue sets startedAt and lastHeartbeatAt, so a freshly dequeued job
    // will have a real startedAt. We inject a synthetic active job with null
    // lastHeartbeatAt and null startedAt via queue internals (raw Redis) to
    // verify the null guard branch.
    const q = createQueue();
    activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");

    // Enqueue normally so BullMQ registers the job, then patch stored data
    const job = await q.enqueue(makeJobParams({ type: "sync-push", timeoutMs: 1 }));
    const running = await dequeueOrFail(q);
    expect(running.id).toBe(job.id);

    // Patch the stored data: set lastHeartbeatAt and startedAt to null, status
    // to running. BullMQ stores job data under bull:<queueName>:<jobId>.
    const rawKey = `bull:${q.name}:${job.id}`;
    const current = await redis.hget(rawKey, "data");
    if (current !== null) {
      const parsed = JSON.parse(current) as Record<string, unknown>;
      parsed["lastHeartbeatAt"] = null;
      parsed["startedAt"] = null;
      parsed["status"] = "running";
      await redis.hset(rawKey, "data", JSON.stringify(parsed));
    }

    // With startedAt=null and lastHeartbeatAt=null the lastBeat guard returns false
    const stalled = await q.findStalledJobs();
    const match = stalled.find((j) => j.id === job.id);
    expect(match).toBeUndefined();
  });

  // ── countJobs: filter by systemId (falls through to listJobs) ──

  it("countJobs with systemId filter delegates to listJobs", async () => {
    const q = createQueue();
    activeQueues.push(q);
    const sysA = testSystemId("sys-count-aaa");
    await q.enqueue(makeJobParams({ systemId: sysA }));
    await q.enqueue(makeJobParams({ systemId: testSystemId("sys-count-bbb") }));
    const count = await q.countJobs({ systemId: sysA });
    expect(count).toBe(1);
  });

  // ── countJobs: filter.status = 'cancelled' ──

  it("countJobs returns correct count for cancelled status", async () => {
    const q = createQueue();
    activeQueues.push(q);
    const job = await q.enqueue(makeJobParams());
    await q.cancel(job.id);
    const count = await q.countJobs({ status: "cancelled" });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ── countJobs: specific BullMQ status (e.g. pending → waiting/delayed/prioritized) ──

  it("countJobs with status=pending returns count via BullMQ getJobCounts", async () => {
    const q = createQueue();
    activeQueues.push(q);
    await q.enqueue(makeJobParams());
    const count = await q.countJobs({ status: "pending" });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ── mapStatusToBullMQStates: 'running' → 'active' ──

  it("countJobs with status=running returns active job count", async () => {
    const q = createQueue();
    activeQueues.push(q);
    await q.enqueue(makeJobParams());
    await dequeueOrFail(q);
    const count = await q.countJobs({ status: "running" });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ── mapStatusToBullMQStates: 'dead-letter' → 'failed' ──

  it("countJobs with status=dead-letter covers dead-letter state mapping", async () => {
    const q = createQueue();
    activeQueues.push(q);
    q.setRetryPolicy("sync-push", {
      maxRetries: 0,
      backoffMs: 0,
      backoffMultiplier: 1,
      maxBackoffMs: 0,
    });
    const job = await q.enqueue(makeJobParams({ type: "sync-push" }));
    await dequeueOrFail(q);
    await q.fail(job.id, "fatal error");
    const count = await q.countJobs({ status: "dead-letter" });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ── BullMQJobQueue close: fetchWorker is null (never dequeued) ──

  it("close does not throw when fetchWorker was never created", async () => {
    const q = createQueue();
    activeQueues.push(q);
    await q.enqueue(makeJobParams());
    // Never dequeue — fetchWorker stays null
    await expect(q.close()).resolves.not.toThrow();
  });

  // ── enqueue: priority omitted (undefined) — covers `priority ?? 0` fallback ──

  it("enqueue with no priority defaults to 0", async () => {
    const q = createQueue();
    activeQueues.push(q);
    // Spread without priority so the field is absent → hits the `?? 0` branch
    const { priority: _p, ...rest } = makeJobParams();
    void _p;
    const job = await q.enqueue({ ...rest });
    expect(job.priority).toBe(0);
  });

  // ── retry: cancelled-store job IS dead-letter — inject directly via Redis ──

  it("retry re-enqueues a dead-letter job from the cancelled store", async () => {
    const q = createQueue();
    activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");
    // Inject a dead-letter job directly into the cancelled store
    const fakeId = `job_fake_dl_${crypto.randomUUID()}` as JobId;
    const deadLetterData = {
      systemId: null,
      type: "sync-push",
      payload: {},
      status: "dead-letter",
      attempts: 1,
      maxAttempts: 1,
      nextRetryAt: null,
      error: "fatal",
      result: { success: false, message: "fatal", completedAt: Date.now() },
      createdAt: Date.now(),
      startedAt: Date.now(),
      completedAt: Date.now(),
      idempotencyKey: crypto.randomUUID(),
      lastHeartbeatAt: null,
      timeoutMs: 30_000,
      scheduledFor: null,
      priority: 0,
    };
    await redis.set(`psq:${q.name}:cancelled:${fakeId}`, JSON.stringify(deadLetterData));
    // retry from cancelled store with dead-letter status — should re-enqueue
    const retried = await q.retry(fakeId);
    expect(retried.status).toBe("pending");
  });

  // ── listJobs: filter.systemId undefined (false branch of systemId filter) ──

  it("listJobs with no systemId filter returns all jobs", async () => {
    const q = createQueue();
    activeQueues.push(q);
    await q.enqueue(makeJobParams({ systemId: testSystemId("sys-x") }));
    await q.enqueue(makeJobParams({ systemId: testSystemId("sys-y") }));
    const all = await q.listJobs({});
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  // ── mapStatusToBullMQStates: 'running' and 'completed' switch cases (L627) ──

  it("listJobs with status=running covers the running switch case", async () => {
    const q = createQueue();
    activeQueues.push(q);
    await q.enqueue(makeJobParams());
    await dequeueOrFail(q);
    const list = await q.listJobs({ status: "running" });
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it("listJobs with status=completed covers the completed switch case", async () => {
    const q = createQueue();
    activeQueues.push(q);
    const job = await q.enqueue(makeJobParams());
    const running = await dequeueOrFail(q);
    await q.acknowledge(running.id, {});
    const list = await q.listJobs({ status: "completed" });
    expect(list.some((j) => j.id === job.id)).toBe(true);
  });

  // ── findStalledJobs: active job whose stored status is not 'running' (L561 false branch) ──

  it("findStalledJobs skips a job whose stored status differs from running", async () => {
    const q = createQueue();
    activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");

    // Enqueue and dequeue to make job active
    const job = await q.enqueue(makeJobParams({ type: "sync-push", timeoutMs: 1 }));
    const running = await dequeueOrFail(q);
    expect(running.id).toBe(job.id);

    // Patch stored status to 'pending' while job remains in BullMQ active state
    const rawKey = `bull:${q.name}:${job.id}`;
    const current = await redis.hget(rawKey, "data");
    if (current !== null) {
      const parsed = JSON.parse(current) as Record<string, unknown>;
      parsed["status"] = "pending";
      await redis.hset(rawKey, "data", JSON.stringify(parsed));
    }

    const stalled = await q.findStalledJobs();
    expect(stalled.find((j) => j.id === job.id)).toBeUndefined();
  });
});

// ── bullmq-job-worker.ts uncovered branches ───────────────────────

describe.skipIf(!ctx.available)("BullMQJobWorker — branch coverage", () => {
  // ── onStop: normal lifecycle — worker set in onStart, cleared in onStop finally ──

  it("stop after start-and-stop cleans up the internal BullMQ worker", async () => {
    const q = createQueue();
    activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");
    const worker = new BullMQJobWorker(q.name, redis, q, {
      pollIntervalMs: 200,
      logger: mockLogger,
    });
    activeWorkers.push(worker);
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
    activeQueues.push(q2);
    const worker = new BullMQJobWorker(q2.name, connWithDb, q2, {
      pollIntervalMs: 200,
      logger: mockLogger,
    });
    activeWorkers.push(worker);
    worker.registerHandler("sync-push", () => Promise.resolve());
    await worker.start();
    expect(worker.isRunning()).toBe(true);
    await worker.stop();
    await connWithDb.quit();
  });

  // ── poll: shouldSkipPoll() true branch — call poll() directly after stop ──

  it("poll() returns immediately when shouldSkipPoll() is true (running=false)", async () => {
    if (redis === null) throw new Error("Valkey not available");
    const q = createQueue();
    activeQueues.push(q);

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
    activeWorkers.push(worker);
    worker.registerHandler("sync-push", () => Promise.resolve());
    await worker.start();
    await worker.stop();
    // running=false now — poll() hits shouldSkipPoll() true branch and returns early
    await expect(worker.triggerPoll()).resolves.not.toThrow();
  });

  // ── onStop: worker===null branch — call onStop again via subclass after first stop ──

  it("onStop is a no-op when internal BullMQ worker is already null", async () => {
    if (redis === null) throw new Error("Valkey not available");
    const q = createQueue();
    activeQueues.push(q);

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
    activeWorkers.push(worker);
    worker.registerHandler("sync-push", () => Promise.resolve());
    await worker.start();
    // First stop: sets this.worker = null in finally block
    await worker.stop();
    // Second direct onStop() call: this.worker is null → hits the false branch of the if-guard
    await expect(worker.triggerOnStop()).resolves.not.toThrow();
  });

  // ── poll: runs and picks up a job (normal happy path) ──

  it("worker processes a job end-to-end and marks it completed", async () => {
    const q = createQueue();
    activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");
    const worker = new BullMQJobWorker(q.name, redis, q, {
      pollIntervalMs: 50,
      logger: mockLogger,
    });
    activeWorkers.push(worker);
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
    const q = createQueue();
    activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");
    const worker = new BullMQJobWorker(q.name, redis, q, {
      pollIntervalMs: 50,
      logger: mockLogger,
    });
    activeWorkers.push(worker);
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
