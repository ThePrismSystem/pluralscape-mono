import { describe, expect, it } from "vitest";

import { InMemoryJobMetrics } from "../observability/job-metrics.js";

describe("InMemoryJobMetrics", () => {
  it("returns zero metrics for a type that has not been touched", () => {
    const metrics = new InMemoryJobMetrics();
    const m = metrics.getTypeMetrics("sync-push");
    expect(m.enqueued).toBe(0);
    expect(m.completed).toBe(0);
    expect(m.failed).toBe(0);
    expect(m.deadLettered).toBe(0);
    expect(m.totalDurationMs).toBe(0);
  });

  it("records enqueue counts per type", () => {
    const metrics = new InMemoryJobMetrics();
    metrics.recordEnqueue("sync-push");
    metrics.recordEnqueue("sync-push");
    metrics.recordEnqueue("blob-upload");
    expect(metrics.getTypeMetrics("sync-push").enqueued).toBe(2);
    expect(metrics.getTypeMetrics("blob-upload").enqueued).toBe(1);
  });

  it("records complete with cumulative duration", () => {
    const metrics = new InMemoryJobMetrics();
    metrics.recordComplete("sync-push", 100);
    metrics.recordComplete("sync-push", 200);
    const m = metrics.getTypeMetrics("sync-push");
    expect(m.completed).toBe(2);
    expect(m.totalDurationMs).toBe(300);
  });

  it("records failure per type", () => {
    const metrics = new InMemoryJobMetrics();
    metrics.recordFailure("webhook-deliver");
    metrics.recordFailure("webhook-deliver");
    expect(metrics.getTypeMetrics("webhook-deliver").failed).toBe(2);
  });

  it("records dead-letter per type", () => {
    const metrics = new InMemoryJobMetrics();
    metrics.recordDeadLetter("blob-upload");
    expect(metrics.getTypeMetrics("blob-upload").deadLettered).toBe(1);
  });

  it("aggregates totals across all types", () => {
    const metrics = new InMemoryJobMetrics();
    metrics.recordEnqueue("sync-push");
    metrics.recordEnqueue("blob-upload");
    metrics.recordComplete("sync-push", 50);
    metrics.recordFailure("blob-upload");
    metrics.recordDeadLetter("blob-upload");

    const agg = metrics.getAggregateMetrics();
    expect(agg.totalEnqueued).toBe(2);
    expect(agg.totalCompleted).toBe(1);
    expect(agg.totalFailed).toBe(1);
    expect(agg.totalDeadLettered).toBe(1);
    expect(agg.byType["sync-push"]?.enqueued).toBe(1);
    expect(agg.byType["blob-upload"]?.failed).toBe(1);
  });

  it("getTypeMetrics returns a snapshot — mutations do not affect internal state", () => {
    const metrics = new InMemoryJobMetrics();
    metrics.recordEnqueue("sync-push");
    const snap1 = metrics.getTypeMetrics("sync-push");

    metrics.recordEnqueue("sync-push");
    const snap2 = metrics.getTypeMetrics("sync-push");

    expect(snap1.enqueued).toBe(1);
    expect(snap2.enqueued).toBe(2);
  });

  it("aggregate byType entries are copies — mutations do not affect internal state", () => {
    const metrics = new InMemoryJobMetrics();
    metrics.recordEnqueue("sync-push");
    const agg = metrics.getAggregateMetrics();
    const entry = agg.byType["sync-push"];
    if (entry !== undefined) {
      entry.enqueued = 999;
    }
    expect(metrics.getTypeMetrics("sync-push").enqueued).toBe(1);
  });
});
