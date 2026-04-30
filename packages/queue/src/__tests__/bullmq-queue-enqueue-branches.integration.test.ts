import { toUnixMillis, brandId } from "@pluralscape/types";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { IdempotencyConflictError, InvalidJobTransitionError } from "../errors.js";

import {
  createQueue,
  createTracking,
  ioredisRejectionHandler,
  teardownTracking,
} from "./helpers/bullmq-test-fixtures.js";
import { dequeueOrFail, makeJobParams } from "./helpers.js";
import { ensureValkey } from "./valkey-container.js";

import type { ValkeyTestContext } from "./valkey-container.js";
import type { JobId } from "@pluralscape/types";
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

describe.skipIf(!ctx.available)("BullMQJobQueue — enqueue/idempotency branch coverage", () => {
  // ── enqueue: scheduledFor in the past (delay = 0 via Math.max branch) ──

  it("enqueues a job scheduled in the past and dequeues it immediately", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    const pastTime = toUnixMillis(Date.now() - 5_000);
    const job = await q.enqueue(makeJobParams({ scheduledFor: pastTime }));
    expect(job.scheduledFor).toBe(pastTime);
    const dequeued = await q.dequeue();
    expect(dequeued?.id).toBe(job.id);
  });

  // ── enqueue: explicit priority provided (covers priority ?? 0 true branch) ──

  it("enqueues with an explicit non-zero priority", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    const job = await q.enqueue(makeJobParams({ priority: 5 }));
    expect(job.priority).toBe(5);
    const fetched = await q.getJob(job.id);
    expect(fetched?.priority).toBe(5);
  });

  // ── enqueue: idem key exists but existingId is null in Redis (key expired
  //    between SET NX and GET) — tested by manually deleting the key ──

  it("re-enqueues when idempotency key exists but maps to null (covers existingId null branch)", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
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
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
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
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    const key = crypto.randomUUID();
    await q.enqueue(makeJobParams({ idempotencyKey: key }));
    // Second enqueue with same key — job still pending
    await expect(q.enqueue(makeJobParams({ idempotencyKey: key }))).rejects.toThrow(
      IdempotencyConflictError,
    );
  });

  // ── checkIdempotency: idem key exists but mapped job is gone (covers job===null branch) ──

  it("checkIdempotency returns exists:false when idem key points to a missing job", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");
    const key = crypto.randomUUID();
    // Point the idem key at a non-existent job ID
    await redis.set(`psq:${q.name}:idem:${key}`, "job_ghost_does_not_exist");
    const result = await q.checkIdempotency(key);
    expect(result.exists).toBe(false);
  });

  // ── enqueue: priority omitted (undefined) — covers `priority ?? 0` fallback ──

  it("enqueue with no priority defaults to 0", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    // Spread without priority so the field is absent → hits the `?? 0` branch
    const { priority: _p, ...rest } = makeJobParams();
    void _p;
    const job = await q.enqueue({ ...rest });
    expect(job.priority).toBe(0);
  });

  // ── BullMQJobQueue close: fetchWorker is null (never dequeued) ──

  it("close does not throw when fetchWorker was never created", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    await q.enqueue(makeJobParams());
    // Never dequeue — fetchWorker stays null
    await expect(q.close()).resolves.not.toThrow();
  });
});

describe.skipIf(!ctx.available)("BullMQJobQueue — dequeue/cancel/retry branch coverage", () => {
  // ── dequeue: put-back for nextRetryAt in the future ──

  it("does not dequeue a job whose nextRetryAt is in the future", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
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
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    await q.enqueue(makeJobParams({ type: "blob-upload" }));
    // dequeue filtering for sync-push only — should not pick up blob-upload
    const result = await q.dequeue(["sync-push"]);
    expect(result).toBeNull();
  });

  // ── retry: job in cancelled store but not dead-letter ──

  it("retry throws InvalidJobTransitionError for cancelled-store job that is not dead-letter", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    const job = await q.enqueue(makeJobParams());
    await q.cancel(job.id);
    // The job is now in the cancelled store with status 'cancelled'
    await expect(q.retry(job.id)).rejects.toThrow(InvalidJobTransitionError);
  });

  // ── cancel: re-cancel a job already in cancelled store ──

  it("cancels a job that is already in the cancelled store (re-cancel path)", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    const job = await q.enqueue(makeJobParams());
    await q.cancel(job.id);
    // Cancel again — hits the cancelledRaw !== null branch
    const result = await q.cancel(job.id);
    expect(result.status).toBe("cancelled");
  });

  // ── cancel: throw when cancelling a completed job in the cancelled store ──

  it("cancel throws InvalidJobTransitionError for completed job in cancelled store", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");
    // Manually inject a completed job into the cancelled store
    const fakeId = brandId<JobId>(`job_fake_${crypto.randomUUID()}`);
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
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    const job = await q.enqueue(makeJobParams());
    await q.cancel(job.id);
    const fetched = await q.getJob(job.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.status).toBe("cancelled");
  });

  // ── retry: cancelled-store job IS dead-letter — inject directly via Redis ──

  it("retry re-enqueues a dead-letter job from the cancelled store", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");
    // Inject a dead-letter job directly into the cancelled store
    const fakeId = brandId<JobId>(`job_fake_dl_${crypto.randomUUID()}`);
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
});
