import { now } from "@pluralscape/types/runtime";

import type { JobQueue } from "../job-queue.js";
import type { JobWorker } from "../job-worker.js";
import type { AggregateMetrics, JobMetrics } from "./job-metrics.js";
import type { UnixMillis } from "@pluralscape/types";

export interface QueueHealthSummary {
  /** When the snapshot was taken. */
  readonly timestamp: UnixMillis;
  /** Number of jobs waiting to be processed. */
  readonly pendingCount: number;
  /** Number of jobs currently being processed. */
  readonly runningCount: number;
  /** Number of jobs in the dead-letter queue. */
  readonly dlqDepth: number;
  /** Number of running jobs whose heartbeat has timed out. */
  readonly stalledCount: number;
  /** Whether the associated worker is currently polling. */
  readonly isWorkerRunning: boolean;
  /** Aggregate metrics snapshot. */
  readonly metrics: AggregateMetrics;
}

export class QueueHealthService {
  private readonly queue: JobQueue;
  private readonly metrics: JobMetrics;
  private readonly worker: JobWorker | undefined;
  private readonly clock: () => UnixMillis;

  constructor(
    queue: JobQueue,
    metrics: JobMetrics,
    worker?: JobWorker,
    clock: () => UnixMillis = now,
  ) {
    this.queue = queue;
    this.metrics = metrics;
    this.worker = worker;
    this.clock = clock;
  }

  async getSummary(): Promise<QueueHealthSummary> {
    const [pendingCount, runningCount, dlqDepth, stalled] = await Promise.all([
      this.queue.countJobs({ status: "pending" }),
      this.queue.countJobs({ status: "running" }),
      this.queue.countJobs({ status: "dead-letter" }),
      this.queue.findStalledJobs(),
    ]);

    return {
      timestamp: this.clock(),
      pendingCount,
      runningCount,
      dlqDepth,
      stalledCount: stalled.length,
      isWorkerRunning: this.worker?.isRunning() ?? false,
      metrics: this.metrics.getAggregateMetrics(),
    };
  }
}
