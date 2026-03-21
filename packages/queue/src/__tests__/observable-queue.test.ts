import { toUnixMillis } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import { InMemoryJobMetrics } from "../observability/job-metrics.js";
import { ObservableJobQueue } from "../observability/observable-queue.js";

import { dequeueOrFail, makeJobParams } from "./helpers.js";
import { InMemoryJobQueue } from "./mock-queue.js";

import type { Logger, UnixMillis } from "@pluralscape/types";

function makeLogger(): {
  logger: Logger;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  const info = vi.fn();
  const warn = vi.fn();
  const error = vi.fn();
  const logger: Logger = { info, warn, error };
  return { logger, info, warn, error };
}

function makeObservable(clock?: () => UnixMillis) {
  const { logger, info, warn, error } = makeLogger();
  const inner = new InMemoryJobQueue(logger, clock);
  const metrics = new InMemoryJobMetrics();
  const queue =
    clock !== undefined
      ? new ObservableJobQueue(inner, metrics, logger, clock)
      : new ObservableJobQueue(inner, metrics, logger);
  return { inner, metrics, logger, info, warn, error, queue };
}

describe("ObservableJobQueue", () => {
  it("records enqueue metric and logs on enqueue", async () => {
    const { metrics, info, queue } = makeObservable();
    await queue.enqueue(makeJobParams({ type: "sync-push" }));
    expect(metrics.getTypeMetrics("sync-push").enqueued).toBe(1);
    expect(info).toHaveBeenCalledWith(
      "job.enqueued",
      expect.objectContaining({ type: "sync-push" }),
    );
  });

  it("records complete metric and logs on acknowledge", async () => {
    let t = toUnixMillis(1000);
    const clock = (): UnixMillis => t;
    const { inner, metrics, info, queue } = makeObservable(clock);

    const job = await queue.enqueue(makeJobParams({ type: "sync-push" }));
    // Dequeue via inner so startedAt is set using the shared clock
    const running = await inner.dequeue();
    if (running === null) throw new Error("Expected a running job");

    t = toUnixMillis(1500);
    await queue.acknowledge(running.id, {});

    expect(metrics.getTypeMetrics("sync-push").completed).toBe(1);
    // durationMs = 1500 - 1000 = 500
    expect(metrics.getTypeMetrics("sync-push").totalDurationMs).toBe(500);
    expect(info).toHaveBeenCalledWith("job.completed", expect.objectContaining({ jobId: job.id }));
  });

  it("records failure metric and logs on fail with retries remaining", async () => {
    const { inner, metrics, warn, queue } = makeObservable();
    await queue.enqueue(makeJobParams({ type: "webhook-deliver", maxAttempts: 3 }));
    const running = await dequeueOrFail(inner);

    await queue.fail(running.id, "timeout");

    expect(metrics.getTypeMetrics("webhook-deliver").failed).toBe(1);
    expect(metrics.getTypeMetrics("webhook-deliver").deadLettered).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      "job.failed",
      expect.objectContaining({ type: "webhook-deliver" }),
    );
  });

  it("records dead-letter metric and logs on fail with no retries remaining", async () => {
    const { inner, metrics, warn, queue } = makeObservable();
    // maxAttempts: 1 means no retries — first failure is a dead letter
    await queue.enqueue(makeJobParams({ type: "blob-upload", maxAttempts: 1 }));
    const running = await dequeueOrFail(inner);

    await queue.fail(running.id, "disk full");

    expect(metrics.getTypeMetrics("blob-upload").deadLettered).toBe(1);
    expect(metrics.getTypeMetrics("blob-upload").failed).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      "job.dead-lettered",
      expect.objectContaining({ type: "blob-upload" }),
    );
  });

  it("pass-through methods delegate to inner queue without recording metrics", async () => {
    const { inner, metrics, queue } = makeObservable();
    await queue.enqueue(makeJobParams({ type: "sync-push" }));
    const running = await dequeueOrFail(inner);

    const fetched = await queue.getJob(running.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(running.id);

    const listed = await queue.listJobs({ status: "running" });
    expect(listed).toHaveLength(1);

    // Only enqueue was recorded — no completion metrics
    expect(metrics.getTypeMetrics("sync-push").completed).toBe(0);
  });

  it("logs on dequeue when a job is found", async () => {
    const { info, queue } = makeObservable();
    const job = await queue.enqueue(makeJobParams({ type: "sync-push" }));
    // Dequeue via observable — should log
    const dequeued = await queue.dequeue();
    expect(dequeued).not.toBeNull();
    expect(info).toHaveBeenCalledWith(
      "job.dequeued",
      expect.objectContaining({ jobId: job.id, type: "sync-push" }),
    );
  });

  it("does not log on dequeue when queue is empty", async () => {
    const { info, queue } = makeObservable();
    const result = await queue.dequeue();
    expect(result).toBeNull();
    expect(info).not.toHaveBeenCalledWith("job.dequeued", expect.anything());
  });

  it("logs on retry", async () => {
    const { inner, info, queue } = makeObservable();
    await queue.enqueue(makeJobParams({ type: "sync-push", maxAttempts: 1 }));
    const running = await dequeueOrFail(inner);
    await inner.fail(running.id, "err");
    await queue.retry(running.id);
    expect(info).toHaveBeenCalledWith(
      "job.retried",
      expect.objectContaining({ jobId: running.id, type: "sync-push" }),
    );
  });

  it("logs on cancel", async () => {
    const { info, queue } = makeObservable();
    const job = await queue.enqueue(makeJobParams({ type: "sync-push" }));
    await queue.cancel(job.id);
    expect(info).toHaveBeenCalledWith(
      "job.cancelled",
      expect.objectContaining({ jobId: job.id, type: "sync-push" }),
    );
  });

  it("implements the full JobQueue interface (delegates policy methods)", () => {
    const { queue } = makeObservable();
    const policy = queue.getRetryPolicy("sync-push");
    expect(policy.maxRetries).toBeGreaterThanOrEqual(0);
  });
});
