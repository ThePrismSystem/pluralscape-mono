import { now } from "@pluralscape/types/runtime";

import type { JobEventHooks } from "../event-hooks.js";
import type { JobQueue } from "../job-queue.js";
import type { IdempotencyCheckResult, JobEnqueueParams, JobFilter } from "../types.js";
import type { JobLogger } from "./job-logger.js";
import type { JobMetrics } from "./job-metrics.js";
import type { JobDefinition, JobId, JobType, RetryPolicy, UnixMillis } from "@pluralscape/types";

/**
 * Decorator that wraps a JobQueue to record metrics and emit structured log lines
 * on every state transition without modifying the underlying implementation.
 */
export class ObservableJobQueue implements JobQueue {
  private readonly inner: JobQueue;
  private readonly metrics: JobMetrics;
  private readonly logger: JobLogger;
  private readonly clock: () => UnixMillis;

  constructor(
    inner: JobQueue,
    metrics: JobMetrics,
    logger: JobLogger,
    clock: () => UnixMillis = now,
  ) {
    this.inner = inner;
    this.metrics = metrics;
    this.logger = logger;
    this.clock = clock;
  }

  async enqueue<T extends JobType>(params: JobEnqueueParams<T>): Promise<JobDefinition> {
    const job = await this.inner.enqueue(params);
    this.metrics.recordEnqueue(job.type);
    this.logger.info("job.enqueued", { jobId: job.id, type: job.type });
    return job;
  }

  checkIdempotency(key: string): Promise<IdempotencyCheckResult> {
    return this.inner.checkIdempotency(key);
  }

  async dequeue(types?: readonly JobType[]): Promise<JobDefinition | null> {
    const job = await this.inner.dequeue(types);
    if (job !== null) {
      this.logger.info("job.dequeued", { jobId: job.id, type: job.type });
    }
    return job;
  }

  async acknowledge(jobId: JobId, result: { message?: string }): Promise<JobDefinition> {
    const job = await this.inner.acknowledge(jobId, result);
    const durationMs = job.startedAt !== null ? this.clock() - job.startedAt : 0;
    this.metrics.recordComplete(job.type, durationMs);
    this.logger.info("job.completed", { jobId: job.id, type: job.type, durationMs });
    return job;
  }

  async fail(jobId: JobId, error: string): Promise<JobDefinition> {
    const job = await this.inner.fail(jobId, error);
    if (job.status === "dead-letter") {
      this.metrics.recordDeadLetter(job.type);
      this.logger.warn("job.dead-lettered", { jobId: job.id, type: job.type, error });
    } else {
      this.metrics.recordFailure(job.type);
      this.logger.warn("job.failed", {
        jobId: job.id,
        type: job.type,
        error,
        attempts: job.attempts,
      });
    }
    return job;
  }

  async retry(jobId: JobId): Promise<JobDefinition> {
    const job = await this.inner.retry(jobId);
    this.logger.info("job.retried", { jobId: job.id, type: job.type });
    return job;
  }

  async cancel(jobId: JobId): Promise<JobDefinition> {
    const job = await this.inner.cancel(jobId);
    this.logger.info("job.cancelled", { jobId: job.id, type: job.type });
    return job;
  }

  getJob(jobId: JobId): Promise<JobDefinition | null> {
    return this.inner.getJob(jobId);
  }

  listJobs(filter: JobFilter): Promise<readonly JobDefinition[]> {
    return this.inner.listJobs(filter);
  }

  listDeadLettered(
    filter?: Pick<JobFilter, "type" | "systemId" | "limit" | "offset">,
  ): Promise<readonly JobDefinition[]> {
    return this.inner.listDeadLettered(filter);
  }

  heartbeat(jobId: JobId): Promise<void> {
    return this.inner.heartbeat(jobId);
  }

  findStalledJobs(): Promise<readonly JobDefinition[]> {
    return this.inner.findStalledJobs();
  }

  countJobs(filter: JobFilter): Promise<number> {
    return this.inner.countJobs(filter);
  }

  getRetryPolicy(type: JobType): RetryPolicy {
    return this.inner.getRetryPolicy(type);
  }

  setRetryPolicy(type: JobType, policy: RetryPolicy): void {
    this.inner.setRetryPolicy(type, policy);
  }

  setEventHooks(hooks: JobEventHooks): void {
    this.inner.setEventHooks(hooks);
  }
}
