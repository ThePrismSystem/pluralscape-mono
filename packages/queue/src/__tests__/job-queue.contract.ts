/**
 * Contract test suite for JobQueue implementations.
 *
 * Usage:
 *   import { runJobQueueContract } from "./job-queue.contract.js";
 *   runJobQueueContract(() => new YourJobQueue());
 *
 * The factory function is called before each test to produce a fresh, empty queue.
 */
import { describe, expect, it, vi } from "vitest";

import {
  IdempotencyConflictError,
  InvalidJobTransitionError,
  JobNotFoundError,
} from "../errors.js";

import { dequeueOrFail, makeJobParams, testSystemId } from "./helpers.js";

import type { JobQueue } from "../job-queue.js";
import type { JobId, JobType, RetryPolicy, UnixMillis } from "@pluralscape/types";

const GHOST_JOB_ID = "job_ghost" as JobId;

export function runJobQueueContract(factory: () => JobQueue): void {
  describe("JobQueue contract", () => {
    // ── 1. enqueue / getJob round-trip ──────────────────────────────

    describe("enqueue / getJob round-trip", () => {
      it("enqueues a job and retrieves it by ID", async () => {
        const queue = factory();
        const params = makeJobParams({ type: "sync-push", payload: { docId: "d1" } });
        const job = await queue.enqueue(params);

        expect(job.type).toBe("sync-push");
        expect(job.status).toBe("pending");
        expect(job.payload).toEqual({ docId: "d1" });
        expect(job.idempotencyKey).toBe(params.idempotencyKey);
        expect(job.attempts).toBe(0);

        const fetched = await queue.getJob(job.id);
        expect(fetched).not.toBeNull();
        expect(fetched?.id).toBe(job.id);
      });

      it("getJob returns null for unknown ID", async () => {
        const queue = factory();
        const result = await queue.getJob(GHOST_JOB_ID);
        expect(result).toBeNull();
      });
    });

    // ── 2. Scheduling ───────────────────────────────────────────────

    describe("scheduled jobs", () => {
      it("does not dequeue a job before its scheduledFor time", async () => {
        const queue = factory();
        const futureTime = (Date.now() + 60_000) as UnixMillis;
        await queue.enqueue(makeJobParams({ scheduledFor: futureTime }));
        const dequeued = await queue.dequeue();
        expect(dequeued).toBeNull();
      });

      it("dequeues a job once its scheduledFor time has passed", async () => {
        const queue = factory();
        const pastTime = (Date.now() - 1000) as UnixMillis;
        const job = await queue.enqueue(makeJobParams({ scheduledFor: pastTime }));
        const dequeued = await queue.dequeue();
        expect(dequeued?.id).toBe(job.id);
      });
    });

    // ── 3. Idempotency ──────────────────────────────────────────────

    describe("idempotency", () => {
      it("throws IdempotencyConflictError for pending job with same key", async () => {
        const queue = factory();
        const key = "idem-key-pending";
        await queue.enqueue(makeJobParams({ idempotencyKey: key }));
        await expect(queue.enqueue(makeJobParams({ idempotencyKey: key }))).rejects.toThrow(
          IdempotencyConflictError,
        );
      });

      it("throws IdempotencyConflictError for running job with same key", async () => {
        const queue = factory();
        const key = "idem-key-running";
        await queue.enqueue(makeJobParams({ idempotencyKey: key }));
        await queue.dequeue();
        await expect(queue.enqueue(makeJobParams({ idempotencyKey: key }))).rejects.toThrow(
          IdempotencyConflictError,
        );
      });

      it("allows re-enqueue when existing job with same key is completed", async () => {
        const queue = factory();
        const key = "idem-key-completed";
        await queue.enqueue(makeJobParams({ idempotencyKey: key }));
        const job = await dequeueOrFail(queue);
        await queue.acknowledge(job.id, {});
        const second = await queue.enqueue(makeJobParams({ idempotencyKey: key }));
        expect(second.status).toBe("pending");
      });
    });

    // ── 4. checkIdempotency ─────────────────────────────────────────

    describe("checkIdempotency", () => {
      it("returns { exists: false } for unknown key", async () => {
        const queue = factory();
        const result = await queue.checkIdempotency("unknown-key");
        expect(result.exists).toBe(false);
      });

      it("returns { exists: true, existingJob } for known key", async () => {
        const queue = factory();
        const key = "check-idem-key";
        const enqueued = await queue.enqueue(makeJobParams({ idempotencyKey: key }));
        const result = await queue.checkIdempotency(key);
        expect(result.exists).toBe(true);
        if (result.exists) {
          expect(result.existingJob.id).toBe(enqueued.id);
        }
      });
    });

    // ── 5. dequeue ──────────────────────────────────────────────────

    describe("dequeue", () => {
      it("returns null when queue is empty", async () => {
        const queue = factory();
        expect(await queue.dequeue()).toBeNull();
      });

      it("transitions job from pending to running", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams());
        const job = await queue.dequeue();
        expect(job).not.toBeNull();
        expect(job?.status).toBe("running");
        expect(job?.startedAt).not.toBeNull();
      });

      it("does not return the same job twice (atomic transition)", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams());
        const first = await queue.dequeue();
        expect(first).not.toBeNull();
        const second = await queue.dequeue();
        expect(second).toBeNull();
      });

      it("dequeues higher-priority job first (lower number = higher priority)", async () => {
        const queue = factory();
        const low = await queue.enqueue(makeJobParams({ priority: 10, idempotencyKey: "low" }));
        const high = await queue.enqueue(makeJobParams({ priority: 1, idempotencyKey: "high" }));
        const dequeued = await queue.dequeue();
        expect(dequeued?.id).toBe(high.id);
        const next = await queue.dequeue();
        expect(next?.id).toBe(low.id);
      });
    });

    // ── 6. dequeue with type filter ─────────────────────────────────

    describe("dequeue with type filter", () => {
      it("only dequeues jobs of the specified types", async () => {
        const queue = factory();
        const push = await queue.enqueue(
          makeJobParams({ type: "sync-push", idempotencyKey: "push" }),
        );
        await queue.enqueue(makeJobParams({ type: "sync-pull", idempotencyKey: "pull" }));
        const dequeued = await queue.dequeue(["sync-push"]);
        expect(dequeued?.id).toBe(push.id);
        const next = await queue.dequeue(["sync-push"]);
        expect(next).toBeNull();
      });

      it("returns null when no jobs match the type filter", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams({ type: "sync-pull" }));
        const dequeued = await queue.dequeue(["blob-upload"] as JobType[]);
        expect(dequeued).toBeNull();
      });
    });

    // ── 7. acknowledge ──────────────────────────────────────────────

    describe("acknowledge", () => {
      it("transitions a running job to completed", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams());
        const running = await dequeueOrFail(queue);
        const completed = await queue.acknowledge(running.id, { message: "done" });
        expect(completed.status).toBe("completed");
        expect(completed.completedAt).not.toBeNull();
        expect(completed.result?.message).toBe("done");
      });

      it("triggers onComplete hook", async () => {
        const queue = factory();
        const onComplete = vi.fn();
        queue.setEventHooks({ onComplete });
        await queue.enqueue(makeJobParams());
        const running = await dequeueOrFail(queue);
        await queue.acknowledge(running.id, {});
        expect(onComplete).toHaveBeenCalledOnce();
        expect(onComplete.mock.calls[0]?.[0].status).toBe("completed");
      });

      it("throws JobNotFoundError for unknown job", async () => {
        const queue = factory();
        await expect(queue.acknowledge(GHOST_JOB_ID, {})).rejects.toThrow(JobNotFoundError);
      });

      it("rejects acknowledge on a pending job", async () => {
        const queue = factory();
        const job = await queue.enqueue(makeJobParams());
        await expect(queue.acknowledge(job.id, {})).rejects.toThrow(InvalidJobTransitionError);
      });

      it("rejects double acknowledge on a completed job", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams());
        const running = await dequeueOrFail(queue);
        await queue.acknowledge(running.id, {});
        await expect(queue.acknowledge(running.id, {})).rejects.toThrow(InvalidJobTransitionError);
      });
    });

    // ── 8. fail with retries remaining ─────────────────────────────

    describe("fail (retries remaining)", () => {
      it("increments attempts and sets pending with nextRetryAt", async () => {
        const queue = factory();
        queue.setRetryPolicy("sync-push", {
          maxRetries: 3,
          backoffMs: 100,
          backoffMultiplier: 2,
          maxBackoffMs: 30_000,
        });
        await queue.enqueue(makeJobParams({ type: "sync-push", maxAttempts: 4 }));
        const running = await dequeueOrFail(queue);
        const failed = await queue.fail(running.id, "network error");
        expect(failed.status).toBe("pending");
        expect(failed.attempts).toBe(1);
        expect(failed.error).toBe("network error");
        expect(failed.nextRetryAt).not.toBeNull();
      });

      it("triggers onFail hook", async () => {
        const queue = factory();
        const onFail = vi.fn();
        queue.setEventHooks({ onFail });
        await queue.enqueue(makeJobParams({ maxAttempts: 3 }));
        const running = await dequeueOrFail(queue);
        await queue.fail(running.id, "oops");
        expect(onFail).toHaveBeenCalledOnce();
      });

      it("rejects fail on a pending job", async () => {
        const queue = factory();
        const job = await queue.enqueue(makeJobParams());
        await expect(queue.fail(job.id, "nope")).rejects.toThrow(InvalidJobTransitionError);
      });
    });

    // ── 9. fail at max retries → dead-letter ────────────────────────

    describe("fail (max retries exhausted)", () => {
      it("moves job to dead-letter when attempts >= maxAttempts", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams({ maxAttempts: 1 }));
        const running = await dequeueOrFail(queue);
        const deadLettered = await queue.fail(running.id, "permanent error");
        expect(deadLettered.status).toBe("dead-letter");
      });

      it("triggers onDeadLetter hook", async () => {
        const queue = factory();
        const onDeadLetter = vi.fn();
        queue.setEventHooks({ onDeadLetter });
        await queue.enqueue(makeJobParams({ maxAttempts: 1 }));
        const running = await dequeueOrFail(queue);
        await queue.fail(running.id, "fatal");
        expect(onDeadLetter).toHaveBeenCalledOnce();
      });
    });

    // ── 10. retry ───────────────────────────────────────────────────

    describe("retry", () => {
      it("resets a failed job to pending", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams({ maxAttempts: 1 }));
        const running = await dequeueOrFail(queue);
        await queue.fail(running.id, "err");
        const retried = await queue.retry(running.id);
        expect(retried.status).toBe("pending");
        expect(retried.nextRetryAt).toBeNull();
        expect(retried.error).toBeNull();
      });

      it("resets a dead-letter job to pending", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams({ maxAttempts: 1 }));
        const running = await dequeueOrFail(queue);
        await queue.fail(running.id, "fatal");
        const retried = await queue.retry(running.id);
        expect(retried.status).toBe("pending");
      });

      it("throws JobNotFoundError for unknown job", async () => {
        const queue = factory();
        await expect(queue.retry(GHOST_JOB_ID)).rejects.toThrow(JobNotFoundError);
      });

      it("rejects retry on a pending job", async () => {
        const queue = factory();
        const job = await queue.enqueue(makeJobParams());
        await expect(queue.retry(job.id)).rejects.toThrow(InvalidJobTransitionError);
      });

      it("rejects retry on a running job", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams());
        const running = await dequeueOrFail(queue);
        await expect(queue.retry(running.id)).rejects.toThrow(InvalidJobTransitionError);
      });
    });

    // ── 11. cancel ──────────────────────────────────────────────────

    describe("cancel", () => {
      it("cancels a pending job", async () => {
        const queue = factory();
        const job = await queue.enqueue(makeJobParams());
        const cancelled = await queue.cancel(job.id);
        expect(cancelled.status).toBe("cancelled");
      });

      it("throws JobNotFoundError for unknown job", async () => {
        const queue = factory();
        await expect(queue.cancel(GHOST_JOB_ID)).rejects.toThrow(JobNotFoundError);
      });

      it("rejects cancel on a completed job", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams());
        const running = await dequeueOrFail(queue);
        await queue.acknowledge(running.id, {});
        await expect(queue.cancel(running.id)).rejects.toThrow(InvalidJobTransitionError);
      });

      it("cancels a dead-letter job (non-destructive purge)", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams({ maxAttempts: 1 }));
        const running = await dequeueOrFail(queue);
        await queue.fail(running.id, "fatal");
        const cancelled = await queue.cancel(running.id);
        expect(cancelled.status).toBe("cancelled");
      });
    });

    // ── 12. listJobs ────────────────────────────────────────────────

    describe("listJobs", () => {
      it("returns empty array when no jobs exist", async () => {
        const queue = factory();
        expect(await queue.listJobs({})).toHaveLength(0);
      });

      it("filters by status", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams({ idempotencyKey: "j1" }));
        const secondJob = await queue.enqueue(makeJobParams({ idempotencyKey: "j2" }));
        await queue.dequeue();
        const pending = await queue.listJobs({ status: "pending" });
        expect(pending).toHaveLength(1);
        expect(pending[0]?.id).toBe(secondJob.id);
      });

      it("filters by type", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams({ type: "sync-push", idempotencyKey: "p" }));
        await queue.enqueue(makeJobParams({ type: "blob-upload", idempotencyKey: "b" }));
        const result = await queue.listJobs({ type: "sync-push" });
        expect(result).toHaveLength(1);
        expect(result[0]?.type).toBe("sync-push");
      });

      it("respects limit and offset", async () => {
        const queue = factory();
        for (let i = 0; i < 5; i++) {
          await queue.enqueue(makeJobParams({ idempotencyKey: `job-${String(i)}` }));
        }
        const page = await queue.listJobs({ limit: 2, offset: 1 });
        expect(page).toHaveLength(2);
      });
    });

    // ── 13. listDeadLettered ────────────────────────────────────────

    describe("listDeadLettered", () => {
      it("returns only dead-letter jobs", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams({ idempotencyKey: "dl1", maxAttempts: 1 }));
        await queue.enqueue(makeJobParams({ idempotencyKey: "normal" }));
        const running = await dequeueOrFail(queue);
        await queue.fail(running.id, "err");
        const deadLettered = await queue.listDeadLettered();
        expect(deadLettered).toHaveLength(1);
        expect(deadLettered[0]?.status).toBe("dead-letter");
      });

      it("returns empty array when no dead-letter jobs exist", async () => {
        const queue = factory();
        expect(await queue.listDeadLettered()).toHaveLength(0);
      });
    });

    // ── 14. heartbeat ───────────────────────────────────────────────

    describe("heartbeat", () => {
      it("updates lastHeartbeatAt for a running job", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams());
        const running = await dequeueOrFail(queue);
        const before = running.lastHeartbeatAt;
        await queue.heartbeat(running.id);
        const updated = await queue.getJob(running.id);
        expect(updated?.lastHeartbeatAt).not.toBeNull();
        if (before !== null) {
          expect(updated?.lastHeartbeatAt).toBeGreaterThanOrEqual(before);
        }
      });

      it("throws JobNotFoundError for non-existent job", async () => {
        const queue = factory();
        await expect(queue.heartbeat(GHOST_JOB_ID)).rejects.toThrow(JobNotFoundError);
      });

      it("rejects heartbeat on a pending job", async () => {
        const queue = factory();
        const job = await queue.enqueue(makeJobParams());
        await expect(queue.heartbeat(job.id)).rejects.toThrow(InvalidJobTransitionError);
      });

      it("rejects heartbeat on a completed job", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams());
        const running = await dequeueOrFail(queue);
        await queue.acknowledge(running.id, {});
        await expect(queue.heartbeat(running.id)).rejects.toThrow(InvalidJobTransitionError);
      });
    });

    // ── 15. findStalledJobs ─────────────────────────────────────────

    describe("findStalledJobs", () => {
      it("returns empty array when no running jobs", async () => {
        const queue = factory();
        expect(await queue.findStalledJobs()).toHaveLength(0);
      });

      it("returns empty array when running jobs are within their timeout", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams({ timeoutMs: 60_000 }));
        await queue.dequeue();
        const stalled = await queue.findStalledJobs();
        expect(stalled).toHaveLength(0);
      });
    });

    // ── 16. Retry policy get/set ────────────────────────────────────

    describe("retry policy", () => {
      it("returns a default policy for a type with no override", () => {
        const queue = factory();
        const policy = queue.getRetryPolicy("sync-push");
        expect(policy.maxRetries).toBeGreaterThan(0);
        expect(policy.backoffMs).toBeGreaterThan(0);
      });

      it("stores and retrieves a custom policy", () => {
        const queue = factory();
        const custom: RetryPolicy = {
          maxRetries: 5,
          backoffMs: 500,
          backoffMultiplier: 1.5,
          maxBackoffMs: 10_000,
        };
        queue.setRetryPolicy("blob-upload", custom);
        expect(queue.getRetryPolicy("blob-upload")).toEqual(custom);
      });
    });

    // ── 17. Event hooks invocation ──────────────────────────────────

    describe("event hooks", () => {
      it("replaces previously set hooks", async () => {
        const queue = factory();
        const firstHook = vi.fn();
        const secondHook = vi.fn();
        queue.setEventHooks({ onComplete: firstHook });
        queue.setEventHooks({ onComplete: secondHook });
        await queue.enqueue(makeJobParams());
        const running = await dequeueOrFail(queue);
        await queue.acknowledge(running.id, {});
        expect(firstHook).not.toHaveBeenCalled();
        expect(secondHook).toHaveBeenCalledOnce();
      });
    });

    // ── 18. Priority ordering ───────────────────────────────────────

    describe("priority ordering", () => {
      it("dequeues jobs in priority order across multiple enqueues", async () => {
        const queue = factory();
        const [job5, job1, job3] = await Promise.all([
          queue.enqueue(makeJobParams({ priority: 5, idempotencyKey: "p5" })),
          queue.enqueue(makeJobParams({ priority: 1, idempotencyKey: "p1" })),
          queue.enqueue(makeJobParams({ priority: 3, idempotencyKey: "p3" })),
        ]);
        const order: string[] = [];
        for (let i = 0; i < 3; i++) {
          const job = await queue.dequeue();
          if (job !== null) order.push(job.id);
        }
        expect(order[0]).toBe(job1.id); // priority 1
        expect(order[1]).toBe(job3.id); // priority 3
        expect(order[2]).toBe(job5.id); // priority 5
      });
    });

    // ── 19. countJobs ─────────────────────────────────────────────────

    describe("countJobs", () => {
      it("returns 0 for an empty queue", async () => {
        const queue = factory();
        expect(await queue.countJobs({})).toBe(0);
      });

      it("counts by status filter", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams({ idempotencyKey: "c1" }));
        await queue.enqueue(makeJobParams({ idempotencyKey: "c2" }));
        await queue.dequeue(); // moves one to running
        expect(await queue.countJobs({ status: "pending" })).toBe(1);
        expect(await queue.countJobs({ status: "running" })).toBe(1);
      });

      it("counts by type filter", async () => {
        const queue = factory();
        await queue.enqueue(makeJobParams({ type: "sync-push", idempotencyKey: "ct1" }));
        await queue.enqueue(makeJobParams({ type: "blob-upload", idempotencyKey: "ct2" }));
        expect(await queue.countJobs({ type: "sync-push" })).toBe(1);
      });
    });

    // ── 20. maxRetries wiring ───────────────────────────────────────

    describe("maxRetries wiring", () => {
      it("uses retry policy maxRetries + 1 as maxAttempts when not explicitly set", async () => {
        const queue = factory();
        queue.setRetryPolicy("sync-push", {
          maxRetries: 5,
          backoffMs: 100,
          backoffMultiplier: 2,
          maxBackoffMs: 10_000,
        });
        const job = await queue.enqueue(
          makeJobParams({ type: "sync-push", idempotencyKey: "mr1" }),
        );
        expect(job.maxAttempts).toBe(6); // maxRetries (5) + 1
      });

      it("explicit maxAttempts overrides retry policy", async () => {
        const queue = factory();
        queue.setRetryPolicy("sync-push", {
          maxRetries: 5,
          backoffMs: 100,
          backoffMultiplier: 2,
          maxBackoffMs: 10_000,
        });
        const job = await queue.enqueue(
          makeJobParams({ type: "sync-push", maxAttempts: 3, idempotencyKey: "mr2" }),
        );
        expect(job.maxAttempts).toBe(3);
      });
    });

    // ── 21. Cross-system isolation ──────────────────────────────────

    describe("cross-system isolation", () => {
      it("listJobs with systemId only returns jobs for that system", async () => {
        const queue = factory();
        const systemA = testSystemId("sys_aaaaaaaa-0000-0000-0000-000000000001");
        const systemB = testSystemId("sys_aaaaaaaa-0000-0000-0000-000000000002");
        await queue.enqueue(makeJobParams({ systemId: systemA, idempotencyKey: "a1" }));
        await queue.enqueue(makeJobParams({ systemId: systemB, idempotencyKey: "b1" }));
        const aJobs = await queue.listJobs({ systemId: systemA });
        expect(aJobs).toHaveLength(1);
        expect(aJobs[0]?.systemId).toBe(systemA);
      });
    });
  });
}
