import { describe, expect, it, vi } from "vitest";

import { DLQManager } from "../dlq/dlq-manager.js";

import { dequeueOrFail, makeJobParams } from "./helpers.js";
import { InMemoryJobQueue } from "./mock-queue.js";

function createDLQJob(queue: InMemoryJobQueue): ReturnType<typeof queue.enqueue> {
  return queue.enqueue(makeJobParams({ maxAttempts: 1 }));
}

async function failToDLQ(queue: InMemoryJobQueue): Promise<void> {
  const job = await dequeueOrFail(queue);
  await queue.fail(job.id, "fatal");
}

describe("DLQManager", () => {
  describe("list", () => {
    it("returns empty array when no dead-lettered jobs exist", async () => {
      const queue = new InMemoryJobQueue();
      const dlq = new DLQManager(queue);
      expect(await dlq.list()).toHaveLength(0);
    });

    it("returns dead-lettered jobs", async () => {
      const queue = new InMemoryJobQueue();
      const dlq = new DLQManager(queue);
      await createDLQJob(queue);
      await failToDLQ(queue);

      const jobs = await dlq.list();
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.status).toBe("dead-letter");
    });

    it("filters by type", async () => {
      const queue = new InMemoryJobQueue();
      const dlq = new DLQManager(queue);

      await queue.enqueue(makeJobParams({ type: "sync-push", maxAttempts: 1 }));
      await queue.enqueue(makeJobParams({ type: "blob-upload", maxAttempts: 1 }));

      // Dead-letter the sync-push job
      const job1 = await dequeueOrFail(queue, ["sync-push"]);
      await queue.fail(job1.id, "err");

      // Dead-letter the blob-upload job
      const job2 = await dequeueOrFail(queue, ["blob-upload"]);
      await queue.fail(job2.id, "err");

      const filtered = await dlq.list({ type: "sync-push" });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.type).toBe("sync-push");
    });
  });

  describe("replay", () => {
    it("resets a dead-lettered job to pending", async () => {
      const queue = new InMemoryJobQueue();
      const dlq = new DLQManager(queue);
      const enqueued = await createDLQJob(queue);
      await failToDLQ(queue);

      const replayed = await dlq.replay(enqueued.id);
      expect(replayed.status).toBe("pending");
      expect(replayed.error).toBeNull();
    });
  });

  describe("replayAll", () => {
    it("replays all dead-lettered jobs", async () => {
      const queue = new InMemoryJobQueue();
      const dlq = new DLQManager(queue);

      await createDLQJob(queue);
      await failToDLQ(queue);
      await createDLQJob(queue);
      await failToDLQ(queue);

      const result = await dlq.replayAll();
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("returns zero counts when no dead-lettered jobs", async () => {
      const queue = new InMemoryJobQueue();
      const dlq = new DLQManager(queue);
      const result = await dlq.replayAll();
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
    });

    it("collects errors for jobs that fail to replay", async () => {
      const queue = new InMemoryJobQueue();
      const dlq = new DLQManager(queue);

      await createDLQJob(queue);
      await failToDLQ(queue);
      await createDLQJob(queue);
      await failToDLQ(queue);

      // Make retry fail for the first job
      const jobs = await dlq.list();
      const originalRetry = queue.retry.bind(queue);
      let callCount = 0;
      vi.spyOn(queue, "retry").mockImplementation(async (id) => {
        callCount++;
        if (callCount === 1) throw new Error("retry failed");
        return originalRetry(id);
      });

      const result = await dlq.replayAll();
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.jobId).toBe(jobs[0]?.id);
    });
  });

  describe("purge", () => {
    it("cancels all dead-lettered jobs (non-destructive)", async () => {
      const queue = new InMemoryJobQueue();
      const dlq = new DLQManager(queue);

      await createDLQJob(queue);
      await failToDLQ(queue);
      await createDLQJob(queue);
      await failToDLQ(queue);

      const result = await dlq.purge();
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);

      // Verify they are now cancelled
      const remaining = await dlq.list();
      expect(remaining).toHaveLength(0);

      const cancelled = await queue.listJobs({ status: "cancelled" });
      expect(cancelled).toHaveLength(2);
    });

    it("collects errors for jobs that fail to cancel", async () => {
      const queue = new InMemoryJobQueue();
      const dlq = new DLQManager(queue);

      await createDLQJob(queue);
      await failToDLQ(queue);

      vi.spyOn(queue, "cancel").mockRejectedValue(new Error("cancel failed"));

      const result = await dlq.purge();
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0]?.error).toBe("cancel failed");
    });
  });

  describe("depth", () => {
    it("returns 0 when no dead-lettered jobs", async () => {
      const queue = new InMemoryJobQueue();
      const dlq = new DLQManager(queue);
      expect(await dlq.depth()).toBe(0);
    });

    it("returns the count of dead-lettered jobs", async () => {
      const queue = new InMemoryJobQueue();
      const dlq = new DLQManager(queue);

      await createDLQJob(queue);
      await failToDLQ(queue);
      await createDLQJob(queue);
      await failToDLQ(queue);

      expect(await dlq.depth()).toBe(2);
    });
  });
});
