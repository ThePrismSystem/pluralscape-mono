import { describe } from "vitest";

import { runJobQueueContract } from "./job-queue.contract.js";
import { runJobWorkerContract } from "./job-worker.contract.js";
import { InMemoryJobQueue } from "./mock-queue.js";
import { InMemoryJobWorker } from "./mock-worker.js";

describe("InMemoryJobQueue", () => {
  runJobQueueContract(() => new InMemoryJobQueue());
});

describe("InMemoryJobWorker", () => {
  runJobWorkerContract(
    () => new InMemoryJobQueue(),
    (queue) => new InMemoryJobWorker(queue),
  );
});
