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
  /** Errors encountered while gathering the summary. */
  readonly errors: readonly string[];
}

function extractMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
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
    const [pendingResult, runningResult, dlqResult, stalledResult] = await Promise.allSettled([
      this.queue.countJobs({ status: "pending" }),
      this.queue.countJobs({ status: "running" }),
      this.queue.countJobs({ status: "dead-letter" }),
      this.queue.findStalledJobs(),
    ]);

    const errors: string[] = [];

    const pendingCount =
      pendingResult.status === "fulfilled"
        ? pendingResult.value
        : (errors.push(extractMessage(pendingResult.reason)), 0);
    const runningCount =
      runningResult.status === "fulfilled"
        ? runningResult.value
        : (errors.push(extractMessage(runningResult.reason)), 0);
    const dlqDepth =
      dlqResult.status === "fulfilled"
        ? dlqResult.value
        : (errors.push(extractMessage(dlqResult.reason)), 0);
    const stalledCount =
      stalledResult.status === "fulfilled"
        ? stalledResult.value.length
        : (errors.push(extractMessage(stalledResult.reason)), 0);

    return {
      timestamp: this.clock(),
      pendingCount,
      runningCount,
      dlqDepth,
      stalledCount,
      isWorkerRunning: this.worker?.isRunning() ?? false,
      metrics: this.metrics.getAggregateMetrics(),
      errors,
    };
  }
}
