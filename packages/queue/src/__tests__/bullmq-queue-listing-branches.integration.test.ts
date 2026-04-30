import { afterAll, afterEach, describe, expect, it } from "vitest";

import {
  createQueue,
  createTracking,
  ioredisRejectionHandler,
  teardownTracking,
} from "./helpers/bullmq-test-fixtures.js";
import { dequeueOrFail, makeJobParams, testSystemId } from "./helpers.js";
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

describe.skipIf(!ctx.available)("BullMQJobQueue — listing/count branch coverage", () => {
  // ── listJobs: bullmqStates empty (status = 'cancelled') ──

  it("listJobs with status=cancelled skips corrupt cancelled entries without crashing", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
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
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    const job = await q.enqueue(makeJobParams());
    await q.cancel(job.id);
    const list = await q.listJobs({ status: "cancelled" });
    expect(list.some((j) => j.id === job.id)).toBe(true);
  });

  // ── listJobs: filter by systemId ──

  it("listJobs filters by systemId", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
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
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    await q.enqueue(makeJobParams({ priority: 10 }));
    await q.enqueue(makeJobParams({ priority: 1 }));
    const list = await q.listJobs({});
    const priorities = list.map((j) => j.priority);
    expect(priorities[0]).toBeLessThanOrEqual(priorities[1] ?? Infinity);
  });

  // ── listJobs: filter.systemId undefined (false branch of systemId filter) ──

  it("listJobs with no systemId filter returns all jobs", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    await q.enqueue(makeJobParams({ systemId: testSystemId("sys-x") }));
    await q.enqueue(makeJobParams({ systemId: testSystemId("sys-y") }));
    const all = await q.listJobs({});
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  // ── mapStatusToBullMQStates: 'running' and 'completed' switch cases (L627) ──

  it("listJobs with status=running covers the running switch case", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    await q.enqueue(makeJobParams());
    await dequeueOrFail(q);
    const list = await q.listJobs({ status: "running" });
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it("listJobs with status=completed covers the completed switch case", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    const job = await q.enqueue(makeJobParams());
    const running = await dequeueOrFail(q);
    await q.acknowledge(running.id, {});
    const list = await q.listJobs({ status: "completed" });
    expect(list.some((j) => j.id === job.id)).toBe(true);
  });

  // ── findStalledJobs: active job with status !== 'running' (covers false branch) ──

  it("findStalledJobs ignores active BullMQ jobs whose status field is not running", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
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
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
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
      const parsed: unknown = JSON.parse(current);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("expected `data` hash field to be a JSON object");
      }
      const obj = parsed as { [k: string]: unknown };
      obj["lastHeartbeatAt"] = null;
      obj["startedAt"] = null;
      obj["status"] = "running";
      await redis.hset(rawKey, "data", JSON.stringify(obj));
    }

    // With startedAt=null and lastHeartbeatAt=null the lastBeat guard returns false
    const stalled = await q.findStalledJobs();
    const match = stalled.find((j) => j.id === job.id);
    expect(match).toBeUndefined();
  });

  // ── countJobs: filter by systemId (falls through to listJobs) ──

  it("countJobs with systemId filter delegates to listJobs", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    const sysA = testSystemId("sys-count-aaa");
    await q.enqueue(makeJobParams({ systemId: sysA }));
    await q.enqueue(makeJobParams({ systemId: testSystemId("sys-count-bbb") }));
    const count = await q.countJobs({ systemId: sysA });
    expect(count).toBe(1);
  });

  // ── countJobs: filter.status = 'cancelled' ──

  it("countJobs returns correct count for cancelled status", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    const job = await q.enqueue(makeJobParams());
    await q.cancel(job.id);
    const count = await q.countJobs({ status: "cancelled" });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ── countJobs: specific BullMQ status (e.g. pending → waiting/delayed/prioritized) ──

  it("countJobs with status=pending returns count via BullMQ getJobCounts", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    await q.enqueue(makeJobParams());
    const count = await q.countJobs({ status: "pending" });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ── mapStatusToBullMQStates: 'running' → 'active' ──

  it("countJobs with status=running returns active job count", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
    await q.enqueue(makeJobParams());
    await dequeueOrFail(q);
    const count = await q.countJobs({ status: "running" });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  // ── mapStatusToBullMQStates: 'dead-letter' → 'failed' ──

  it("countJobs with status=dead-letter covers dead-letter state mapping", async () => {
    const q = createQueue(redis);
    tracking.activeQueues.push(q);
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
});
