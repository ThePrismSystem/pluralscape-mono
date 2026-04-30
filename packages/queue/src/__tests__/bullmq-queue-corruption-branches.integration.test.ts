import { brandId } from "@pluralscape/types";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { BullMQJobQueue } from "../adapters/bullmq/bullmq-job-queue.js";
import { QueueCorruptionError } from "../errors.js";

import {
  corruptJobData,
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

// ── Data corruption surfacing (QUEUE-TC-L1) ──────────────────────────
//
// Stored job data can become corrupt through operational mishaps (Redis
// migrations, manual key edits, partial writes, schema drift). When it
// does, callers must receive a typed QueueCorruptionError rather than a
// bare SyntaxError / ZodError leaking across the abstraction boundary.

describe.skipIf(!ctx.available)("BullMQJobQueue — corruption surfacing", () => {
  it("getJob throws QueueCorruptionError on corrupt JSON in the cancelled store", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");

    const fakeId = brandId<JobId>(`job_corrupt_${crypto.randomUUID()}`);
    // Syntactically invalid JSON in the cancelled store
    await redis.set(`psq:${q.name}:cancelled:${fakeId}`, "{not-valid-json");

    await expect(q.getJob(fakeId)).rejects.toBeInstanceOf(QueueCorruptionError);
  });

  it("getJob wraps schema mismatches (missing fields) as QueueCorruptionError", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");

    const fakeId = brandId<JobId>(`job_partial_${crypto.randomUUID()}`);
    // Valid JSON but missing required StoredJobData fields
    await redis.set(
      `psq:${q.name}:cancelled:${fakeId}`,
      JSON.stringify({ type: "sync-push", status: "cancelled" }),
    );

    await expect(q.getJob(fakeId)).rejects.toBeInstanceOf(QueueCorruptionError);
  });

  it("getJob throws QueueCorruptionError when BullMQ-store data blob is malformed", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");

    // Enqueue a real job so BullMQ sets up its hash, then overwrite the
    // JSON data field with a malformed payload.
    const job = await q.enqueue(makeJobParams({ type: "sync-push" }));
    const rawKey = `bull:${q.name}:${job.id}`;
    await redis.hset(rawKey, "data", "{truncated-");

    await expect(q.getJob(job.id)).rejects.toBeInstanceOf(QueueCorruptionError);
  });

  it("getJob throws QueueCorruptionError when type/payload disagree", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");

    // Enqueue a real sync-push job, then rewrite its stored data so the type
    // advertises "webhook-deliver" (which requires `deliveryId`) while the
    // payload is still the empty sync-push shape. The discriminated schema
    // must reject this mismatched (type, payload) pair rather than surfacing
    // a silently-malformed JobDefinition.
    const job = await q.enqueue(makeJobParams({ type: "sync-push" }));
    const rawKey = `bull:${q.name}:${job.id}`;
    const current = await redis.hget(rawKey, "data");
    if (current === null) throw new Error("expected BullMQ hash to contain `data`");
    const parsed = JSON.parse(current) as Record<string, unknown>;
    parsed["type"] = "webhook-deliver";
    parsed["payload"] = { notADeliveryId: true };
    await redis.hset(rawKey, "data", JSON.stringify(parsed));

    await expect(q.getJob(job.id)).rejects.toBeInstanceOf(QueueCorruptionError);
  });

  it("listJobs throws QueueCorruptionError when a stored row has mismatched type/payload", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");

    // Same corruption pattern as the getJob variant: inject a malformed row
    // and verify listJobs fails closed rather than silently returning a
    // malformed JobDefinition to callers who expect the discriminated union
    // invariant to hold.
    const job = await q.enqueue(makeJobParams({ type: "sync-push" }));
    const rawKey = `bull:${q.name}:${job.id}`;
    const current = await redis.hget(rawKey, "data");
    if (current === null) throw new Error("expected BullMQ hash to contain `data`");
    const parsed = JSON.parse(current) as Record<string, unknown>;
    parsed["type"] = "webhook-deliver";
    parsed["payload"] = { notADeliveryId: true };
    await redis.hset(rawKey, "data", JSON.stringify(parsed));

    await expect(q.listJobs({ status: "pending" })).rejects.toBeInstanceOf(QueueCorruptionError);
  });

  it("retry throws QueueCorruptionError when cancelled-store data is corrupt", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");

    const fakeId = brandId<JobId>(`job_retry_corrupt_${crypto.randomUUID()}`);
    await redis.set(`psq:${q.name}:cancelled:${fakeId}`, "][");

    await expect(q.retry(fakeId)).rejects.toBeInstanceOf(QueueCorruptionError);
  });

  it("cancel throws QueueCorruptionError when cancelled-store data is corrupt", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");

    const fakeId = brandId<JobId>(`job_cancel_corrupt_${crypto.randomUUID()}`);
    await redis.set(`psq:${q.name}:cancelled:${fakeId}`, "][");

    await expect(q.cancel(fakeId)).rejects.toBeInstanceOf(QueueCorruptionError);
  });
});

// ── Write-path fail-closed coverage (ps-74xz) ──────────────────────
//
// Every method that reads `job.data` from BullMQ must surface a typed
// QueueCorruptionError when the stored shape fails schema validation —
// the write paths must not silently accept a malformed StoredJobData.
//
// Pattern: enqueue a real job so BullMQ sets up its hash, drive the job
// to the status the method requires (if any), then rewrite the stored
// `data` hash field so its (type, payload) disagrees with the discriminated
// schema. All callers must then throw QueueCorruptionError.

describe.skipIf(!ctx.available)("BullMQJobQueue — write-path corruption surfacing", () => {
  // Each case drives the queue to the status the method requires, corrupts
  // the stored data, and asserts the method surfaces QueueCorruptionError.
  // `driveToRunning` — whether the job must be dequeued first so the method's
  //   reachable parse path is the corrupt one (e.g. acknowledge/heartbeat).
  // `timeoutMs` — overrides the default enqueue timeout; `findStalledJobs`
  //   needs `1` so the stall check considers the job stalled if it parsed.
  interface CorruptionCase {
    readonly name: string;
    readonly driveToRunning: boolean;
    readonly timeoutMs?: number;
    readonly invoke: (q: BullMQJobQueue, id: JobId) => Promise<unknown>;
  }

  const corruptionCases: readonly CorruptionCase[] = [
    { name: "dequeue", driveToRunning: false, invoke: (q) => q.dequeue() },
    { name: "acknowledge", driveToRunning: true, invoke: (q, id) => q.acknowledge(id, {}) },
    { name: "fail", driveToRunning: true, invoke: (q, id) => q.fail(id, "boom") },
    { name: "retry", driveToRunning: false, invoke: (q, id) => q.retry(id) },
    { name: "cancel", driveToRunning: false, invoke: (q, id) => q.cancel(id) },
    { name: "heartbeat", driveToRunning: true, invoke: (q, id) => q.heartbeat(id) },
    {
      name: "findStalledJobs",
      driveToRunning: true,
      timeoutMs: 1,
      invoke: (q) => q.findStalledJobs(),
    },
  ];

  it.each(corruptionCases)(
    "$name throws QueueCorruptionError when stored data is corrupt",
    async ({ driveToRunning, timeoutMs, invoke }) => {
      const q = createQueue(redis);
      tracking.activeQueues.push(q);
      if (redis === null) throw new Error("Valkey not available");

      const enqueueOpts =
        timeoutMs === undefined
          ? { type: "sync-push" as const }
          : { type: "sync-push" as const, timeoutMs };
      const job = await q.enqueue(makeJobParams(enqueueOpts));
      if (driveToRunning) await dequeueOrFail(q);
      await corruptJobData(redis, q.name, job.id);

      await expect(invoke(q, job.id)).rejects.toBeInstanceOf(QueueCorruptionError);
    },
  );

  // ── findStalledJobs mixed-batch fail-closed (I2) ─────────────────────
  //
  // One corrupt active job aborts the ENTIRE sweep, not just that job's
  // row. This is intentional — silently skipping corrupt records would
  // hide stalled-detection gaps from operators. Documented explicitly so
  // schedulers supervising this call don't assume partial success.

  it("findStalledJobs aborts the whole sweep when one of several active jobs is corrupt", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    if (redis === null) throw new Error("Valkey not available");

    const jobA = await q.enqueue(makeJobParams({ type: "sync-push", timeoutMs: 1 }));
    const jobB = await q.enqueue(makeJobParams({ type: "sync-push", timeoutMs: 1 }));
    const jobC = await q.enqueue(makeJobParams({ type: "sync-push", timeoutMs: 1 }));

    await dequeueOrFail(q);
    await dequeueOrFail(q);
    await dequeueOrFail(q);

    await corruptJobData(redis, q.name, jobB.id);

    // Even though jobA and jobC parse cleanly and would be reported stalled,
    // the first corrupt row short-circuits the sweep.
    await expect(q.findStalledJobs()).rejects.toBeInstanceOf(QueueCorruptionError);

    void jobA;
    void jobC;
  });

  it("findStalledJobs skips a job whose stored status differs from running", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
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
