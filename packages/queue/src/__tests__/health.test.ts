import { describe, expect, it } from "vitest";

import { QueueHealthService } from "../observability/health.js";
import { InMemoryJobMetrics } from "../observability/job-metrics.js";

import { dequeueOrFail, makeJobParams } from "./helpers.js";
import { InMemoryJobQueue } from "./mock-queue.js";
import { InMemoryJobWorker } from "./mock-worker.js";

import type { UnixMillis } from "@pluralscape/types";

function makeHealth(worker?: InMemoryJobWorker, clock?: () => UnixMillis) {
  const queue = new InMemoryJobQueue();
  const metrics = new InMemoryJobMetrics();
  const service = new QueueHealthService(queue, metrics, worker, clock);
  return { queue, metrics, service };
}

describe("QueueHealthService", () => {
  it("reports zero counts for an empty queue", async () => {
    const { service } = makeHealth();
    const summary = await service.getSummary();
    expect(summary.pendingCount).toBe(0);
    expect(summary.runningCount).toBe(0);
    expect(summary.dlqDepth).toBe(0);
    expect(summary.stalledCount).toBe(0);
    expect(summary.isWorkerRunning).toBe(false);
  });

  it("counts pending and running jobs correctly", async () => {
    const { queue, service } = makeHealth();
    await queue.enqueue(makeJobParams({ type: "sync-push" }));
    await queue.enqueue(makeJobParams({ type: "blob-upload" }));
    await dequeueOrFail(queue); // moves first job to running

    const summary = await service.getSummary();
    expect(summary.pendingCount).toBe(1);
    expect(summary.runningCount).toBe(1);
  });

  it("counts dead-lettered jobs in dlqDepth", async () => {
    const { queue, service } = makeHealth();
    await queue.enqueue(makeJobParams({ type: "sync-push", maxAttempts: 1 }));
    const running = await dequeueOrFail(queue);
    await queue.fail(running.id, "error");

    const summary = await service.getSummary();
    expect(summary.dlqDepth).toBe(1);
  });

  it("counts stalled jobs", async () => {
    let currentTime = 1000 as UnixMillis;
    const queue = new InMemoryJobQueue(() => currentTime);
    const metrics = new InMemoryJobMetrics();
    const service = new QueueHealthService(queue, metrics, undefined, () => currentTime);

    await queue.enqueue(makeJobParams({ timeoutMs: 5000 }));
    await queue.dequeue();

    currentTime = 7000 as UnixMillis;
    const summary = await service.getSummary();
    expect(summary.stalledCount).toBe(1);
  });

  it("reflects worker running state", async () => {
    const queue = new InMemoryJobQueue();
    const metrics = new InMemoryJobMetrics();
    const worker = new InMemoryJobWorker(queue);
    const service = new QueueHealthService(queue, metrics, worker);

    worker.registerHandler("sync-push", async () => {});
    await worker.start();

    const summary = await service.getSummary();
    expect(summary.isWorkerRunning).toBe(true);

    await worker.stop();
    const summary2 = await service.getSummary();
    expect(summary2.isWorkerRunning).toBe(false);
  });

  it("includes aggregate metrics in the summary", async () => {
    const { queue, metrics, service } = makeHealth();
    metrics.recordEnqueue("sync-push");
    await queue.enqueue(makeJobParams({ type: "sync-push" }));

    const summary = await service.getSummary();
    expect(summary.metrics.totalEnqueued).toBe(1);
  });

  it("uses the injected clock for timestamp", async () => {
    const fixedTime = 12345 as UnixMillis;
    const { service } = makeHealth(undefined, () => fixedTime);
    const summary = await service.getSummary();
    expect(summary.timestamp).toBe(fixedTime);
  });
});
