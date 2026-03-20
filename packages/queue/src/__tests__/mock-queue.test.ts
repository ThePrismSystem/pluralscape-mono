import { describe, expect, it, vi } from "vitest";

import { makeJobParams } from "./helpers.js";
import { runJobQueueContract } from "./job-queue.contract.js";
import { runJobWorkerContract } from "./job-worker.contract.js";
import { InMemoryJobQueue } from "./mock-queue.js";
import { InMemoryJobWorker } from "./mock-worker.js";

import type { Logger, UnixMillis } from "@pluralscape/types";

const mockLogger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe("InMemoryJobQueue", () => {
  runJobQueueContract(() => new InMemoryJobQueue(mockLogger));
});

describe("InMemoryJobWorker", () => {
  runJobWorkerContract(
    () => new InMemoryJobQueue(mockLogger),
    (queue) => new InMemoryJobWorker(queue, { logger: mockLogger }),
  );
});

describe("InMemoryJobQueue-specific", () => {
  describe("findStalledJobs", () => {
    it("detects a stalled job when heartbeat timeout has elapsed", async () => {
      let currentTime = 1000 as UnixMillis;
      const queue = new InMemoryJobQueue(mockLogger, () => currentTime);

      await queue.enqueue(makeJobParams({ timeoutMs: 5000 }));
      await queue.dequeue(); // transitions to running, sets lastHeartbeatAt = 1000

      // Advance time past the timeout
      currentTime = 7000 as UnixMillis;
      const stalled = await queue.findStalledJobs();
      expect(stalled).toHaveLength(1);
      expect(stalled[0]?.status).toBe("running");
    });

    it("does not report a job as stalled when heartbeat resets the clock", async () => {
      let currentTime = 1000 as UnixMillis;
      const queue = new InMemoryJobQueue(mockLogger, () => currentTime);

      await queue.enqueue(makeJobParams({ timeoutMs: 5000 }));
      const job = await queue.dequeue();
      if (job === null) throw new Error("Expected a job to be dequeued");

      // Advance partway (3s into a 5s timeout)
      currentTime = 4000 as UnixMillis;
      await queue.heartbeat(job.id); // resets lastHeartbeatAt to 4000

      // Advance past original timeout but within heartbeat timeout (4000 + 5000 = 9000)
      currentTime = 8000 as UnixMillis;
      const stalled = await queue.findStalledJobs();
      expect(stalled).toHaveLength(0);
    });
  });
});
