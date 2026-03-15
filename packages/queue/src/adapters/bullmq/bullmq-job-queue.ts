import { createId, now } from "@pluralscape/types/runtime";
import { Queue, Worker } from "bullmq";

import {
  IdempotencyConflictError,
  InvalidJobTransitionError,
  JobNotFoundError,
} from "../../errors.js";
import { fireHook } from "../../fire-hook.js";
import { calculateBackoff, DEFAULT_RETRY_POLICY } from "../../policies/index.js";
import {
  DEFAULT_TIMEOUT_MS,
  IDEM_RESERVATION_TTL_SEC,
  PUT_BACK_DELAY_MS,
  SCAN_COUNT,
} from "../../queue.constants.js";

import { fromStoredData } from "./job-mapper.js";

import type { StoredJobData } from "./job-mapper.js";
import type { JobEventHooks } from "../../event-hooks.js";
import type { JobQueue } from "../../job-queue.js";
import type { JobLogger } from "../../observability/job-logger.js";
import type { IdempotencyCheckResult, JobEnqueueParams, JobFilter } from "../../types.js";
import type {
  JobDefinition,
  JobId,
  JobResult,
  JobStatus,
  JobType,
  RetryPolicy,
  UnixMillis,
} from "@pluralscape/types";
import type { Job as BullMQJob } from "bullmq";
import type IORedis from "ioredis";

/**
 * BullMQ-backed implementation of JobQueue.
 *
 * Uses a single BullMQ queue with our JobDefinition embedded in job data.
 * Cancelled jobs are stored in a Redis hash since BullMQ has no native cancel state.
 * Idempotency is tracked via Redis keys.
 */
export class BullMQJobQueue implements JobQueue {
  private readonly retryPolicies = new Map<JobType, RetryPolicy>();
  private hooks: JobEventHooks = {};
  private readonly clock: () => UnixMillis;
  private readonly logger: JobLogger | undefined;
  private readonly queue: Queue;
  private readonly fetchWorker: Worker;
  private readonly redis: IORedis;
  private readonly prefix: string;
  private readonly token: string;
  readonly name: string = "";

  constructor(
    queueName: string,
    connection: IORedis,
    clock?: () => UnixMillis,
    options?: { logger?: JobLogger },
  ) {
    this.clock = clock ?? now;
    this.logger = options?.logger;
    this.redis = connection;
    this.name = queueName;
    this.prefix = `psq:${queueName}`;
    this.token = `token-${createId("tk_")}`;

    this.queue = new Queue(queueName, {
      connection,
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 1, // We handle retries ourselves
      },
    });

    // Worker without processor — used only for getNextJob() in dequeue()
    this.fetchWorker = new Worker(queueName, undefined, {
      connection,
      autorun: false,
    });
  }

  /** Closes BullMQ queue and worker connections. Call during cleanup. */
  async close(): Promise<void> {
    try {
      await this.fetchWorker.close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger?.warn("queue.close-worker-error", { error: msg });
    }
    try {
      await this.queue.close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger?.warn("queue.close-queue-error", { error: msg });
    }
  }

  /** Removes all data for this queue from Redis. For test cleanup only. */
  async obliterate(): Promise<void> {
    // Clean our custom keys (use SCAN to avoid blocking Redis)
    const cancelledKeys = await this.scanKeys(`${this.prefix}:cancelled:*`);
    const idemKeys = await this.scanKeys(`${this.prefix}:idem:*`);
    const allKeys = [...cancelledKeys, ...idemKeys];
    if (allKeys.length > 0) {
      await this.redis.del(...allKeys);
    }
    await this.queue.obliterate({ force: true });
  }

  async enqueue<T extends JobType>(params: JobEnqueueParams<T>): Promise<JobDefinition> {
    // Atomic idempotency check using SET NX to prevent TOCTOU race
    const idemKey = `${this.prefix}:idem:${params.idempotencyKey}`;
    const nxResult = await this.redis.set(
      idemKey,
      "reserving",
      "EX",
      IDEM_RESERVATION_TTL_SEC,
      "NX",
    );

    if (nxResult === null) {
      // Key already exists — check whether the existing job allows re-enqueue
      const existingId = await this.redis.get(idemKey);
      if (existingId !== null && existingId !== "reserving") {
        const existing = await this.getJob(existingId as JobId);
        if (
          existing !== null &&
          existing.status !== "completed" &&
          existing.status !== "cancelled"
        ) {
          throw new IdempotencyConflictError(params.idempotencyKey);
        }
      } else if (existingId === "reserving") {
        // Another concurrent enqueue is in progress
        throw new IdempotencyConflictError(params.idempotencyKey);
      }
      // Completed/cancelled — allow re-enqueue by overwriting
    }

    const id = createId("job_") as JobId;
    const currentTime = this.clock();
    const policy = this.getRetryPolicy(params.type);
    const maxAttempts = params.maxAttempts ?? policy.maxRetries + 1;

    const data: StoredJobData = {
      systemId: params.systemId ?? null,
      type: params.type,
      payload: params.payload as Record<string, unknown>,
      status: "pending",
      attempts: 0,
      maxAttempts,
      nextRetryAt: null,
      error: null,
      result: null,
      createdAt: currentTime,
      startedAt: null,
      completedAt: null,
      idempotencyKey: params.idempotencyKey,
      lastHeartbeatAt: null,
      timeoutMs: params.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      scheduledFor: params.scheduledFor ?? null,
      priority: params.priority ?? 0,
    };

    const delay =
      params.scheduledFor !== undefined ? Math.max(0, params.scheduledFor - currentTime) : 0;

    try {
      await this.queue.add(params.type, data, {
        jobId: id,
        priority: params.priority ?? 0,
        delay,
      });
    } catch (err) {
      // Clean up the NX key on enqueue failure
      if (nxResult !== null) {
        await this.redis.del(idemKey);
      }
      throw err;
    }

    // Update idempotency key to actual job ID
    try {
      await this.redis.set(idemKey, id);
    } catch (err) {
      this.logger?.error("queue.idem-key-update-failed", {
        jobId: id,
        error: err instanceof Error ? err.message : String(err),
      });
      try {
        await this.redis.del(idemKey);
      } catch (delErr) {
        this.logger?.warn("queue.idem-key-cleanup-failed", {
          idemKey,
          error: delErr instanceof Error ? delErr.message : String(delErr),
        });
      }
      throw err;
    }

    return fromStoredData(id, data);
  }

  async checkIdempotency(key: string): Promise<IdempotencyCheckResult> {
    const idemKey = `${this.prefix}:idem:${key}`;
    const jobId = await this.redis.get(idemKey);
    if (jobId === null) return { exists: false };
    const job = await this.getJob(jobId as JobId);
    if (job === null) return { exists: false };
    return { exists: true, existingJob: job };
  }

  /**
   * Dequeues the next eligible job.
   *
   * **Known limitation:** When a `types` filter is provided, non-matching jobs
   * are fetched and then put back via `moveToDelayed`. This means type-filtered
   * dequeue does not guarantee strict priority ordering across all job types —
   * only among the jobs inspected in a single call (up to 20).
   */
  async dequeue(types?: readonly JobType[]): Promise<JobDefinition | null> {
    const currentTime = this.clock();

    // Fetch jobs from BullMQ, putting back non-matching ones
    const putBack: BullMQJob[] = [];
    let result: JobDefinition | null = null;

    try {
      // Try to get up to 20 jobs to find a matching one
      const MAX_FETCH = 20;
      for (let i = 0; i < MAX_FETCH; i++) {
        // getNextJob may return undefined when no jobs available
        const job = (await this.fetchWorker.getNextJob(this.token)) as BullMQJob | undefined;
        if (job === undefined) break;

        const def = job.data as StoredJobData;
        // Check type filter
        if (types !== undefined && !types.includes(def.type)) {
          putBack.push(job);
          continue;
        }

        // Check scheduled time
        if (def.scheduledFor !== null && def.scheduledFor > currentTime) {
          putBack.push(job);
          continue;
        }

        // Check retry time
        if (def.nextRetryAt !== null && def.nextRetryAt > currentTime) {
          putBack.push(job);
          continue;
        }

        // Match found — update to running
        const updated: StoredJobData = {
          ...def,
          status: "running",
          startedAt: currentTime,
          lastHeartbeatAt: currentTime,
        };
        await job.updateData(updated);
        result = fromStoredData(job.id as string, updated);
        break;
      }
    } finally {
      // Put back non-matching jobs
      for (const job of putBack) {
        try {
          await job.moveToDelayed(this.clock() + PUT_BACK_DELAY_MS, this.token);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger?.warn("queue.dequeue-putback-error", { jobId: job.id, error: msg });
        }
      }
    }

    return result;
  }

  async acknowledge(jobId: JobId, result: { message?: string }): Promise<JobDefinition> {
    const job = await this.requireBullMQJob(jobId);
    const def = job.data as StoredJobData;

    if (def.status !== "running") {
      throw new InvalidJobTransitionError(jobId, def.status as JobStatus, "acknowledge");
    }

    const currentTime = this.clock();
    const jobResult: JobResult = {
      success: true,
      message: result.message ?? null,
      completedAt: currentTime,
    };

    const updated: StoredJobData = {
      ...def,
      status: "completed",
      completedAt: currentTime,
      result: jobResult,
    };

    await job.updateData(updated);
    await job.moveToCompleted("done", this.token, false);

    const definition = fromStoredData(jobId, updated);
    await fireHook(this.hooks, "onComplete", definition, undefined, this.logger);
    return definition;
  }

  async fail(jobId: JobId, error: string): Promise<JobDefinition> {
    const job = await this.requireBullMQJob(jobId);
    const def = job.data as StoredJobData;

    if (def.status !== "running") {
      throw new InvalidJobTransitionError(jobId, def.status as JobStatus, "fail");
    }

    const newAttempts = def.attempts + 1;
    const currentTime = this.clock();

    if (newAttempts >= def.maxAttempts) {
      const updated: StoredJobData = {
        ...def,
        status: "dead-letter",
        attempts: newAttempts,
        error,
        result: { success: false, message: error, completedAt: currentTime },
      };
      await job.updateData(updated);
      await job.moveToFailed(new Error(error), this.token, false);

      const definition = fromStoredData(jobId, updated);
      await fireHook(this.hooks, "onFail", definition, new Error(error), this.logger);
      await fireHook(this.hooks, "onDeadLetter", definition, undefined, this.logger);
      return definition;
    }

    const policy = this.getRetryPolicy(def.type);
    const backoff = calculateBackoff(policy, newAttempts);

    const updated: StoredJobData = {
      ...def,
      status: "pending",
      attempts: newAttempts,
      error,
      nextRetryAt: (currentTime + backoff) as UnixMillis,
    };

    await job.updateData(updated);
    await job.moveToDelayed(this.clock() + backoff, this.token);

    const definition = fromStoredData(jobId, updated);
    await fireHook(this.hooks, "onFail", definition, new Error(error), this.logger);
    return definition;
  }

  async retry(jobId: JobId): Promise<JobDefinition> {
    // Check cancelled store first
    const cancelledRaw = await this.redis.get(`${this.prefix}:cancelled:${jobId}`);
    if (cancelledRaw !== null) {
      const parsed = JSON.parse(cancelledRaw) as StoredJobData;
      if (parsed.status !== "dead-letter") {
        throw new InvalidJobTransitionError(jobId, parsed.status as JobStatus, "retry");
      }
      // Re-enqueue from cancelled store
      const updated: StoredJobData = {
        ...parsed,
        status: "pending",
        attempts: 0,
        error: null,
        nextRetryAt: null,
      };
      await this.queue.add(parsed.type, updated, { jobId });
      await this.redis.del(`${this.prefix}:cancelled:${jobId}`);
      return fromStoredData(jobId, updated);
    }

    const job = await this.queue.getJob(jobId);
    if (job === undefined) throw new JobNotFoundError(jobId);

    const def = job.data as StoredJobData;
    if (def.status !== "dead-letter") {
      throw new InvalidJobTransitionError(jobId, def.status as JobStatus, "retry");
    }

    const updated: StoredJobData = {
      ...def,
      status: "pending",
      attempts: 0,
      error: null,
      nextRetryAt: null,
    };
    await job.updateData(updated);
    await job.retry("failed");

    return fromStoredData(jobId, updated);
  }

  async cancel(jobId: JobId): Promise<JobDefinition> {
    // Check cancelled store — already cancelled
    const cancelledRaw = await this.redis.get(`${this.prefix}:cancelled:${jobId}`);
    if (cancelledRaw !== null) {
      const parsed = JSON.parse(cancelledRaw) as StoredJobData;
      if (parsed.status === "completed") {
        throw new InvalidJobTransitionError(jobId, "completed", "cancel");
      }
      const updated: StoredJobData = { ...parsed, status: "cancelled" };
      await this.redis.set(`${this.prefix}:cancelled:${jobId}`, JSON.stringify(updated));
      return fromStoredData(jobId, updated);
    }

    const job = await this.queue.getJob(jobId);
    if (job === undefined) throw new JobNotFoundError(jobId);

    const def = job.data as StoredJobData;
    if (def.status === "completed") {
      throw new InvalidJobTransitionError(jobId, "completed", "cancel");
    }

    const updated: StoredJobData = { ...def, status: "cancelled" };

    // Store in cancelled hash and remove from BullMQ
    await this.redis.set(`${this.prefix}:cancelled:${jobId}`, JSON.stringify(updated));
    await job.remove();

    return fromStoredData(jobId, updated);
  }

  async getJob(jobId: JobId): Promise<JobDefinition | null> {
    // Check BullMQ first
    const job = await this.queue.getJob(jobId);
    if (job !== undefined) {
      return fromStoredData(job.id as string, job.data as StoredJobData);
    }

    // Check cancelled store
    const cancelledRaw = await this.redis.get(`${this.prefix}:cancelled:${jobId}`);
    if (cancelledRaw !== null) {
      return fromStoredData(jobId, JSON.parse(cancelledRaw) as StoredJobData);
    }

    return null;
  }

  async listJobs(filter: JobFilter): Promise<readonly JobDefinition[]> {
    // Get jobs from BullMQ across relevant states
    const bullmqStates = this.mapStatusToBullMQStates(filter.status);
    const bullmqJobs = bullmqStates.length > 0 ? await this.queue.getJobs(bullmqStates) : [];

    let results: JobDefinition[] = bullmqJobs.map((j) =>
      fromStoredData(j.id as string, j.data as StoredJobData),
    );

    // Include cancelled jobs if status filter allows
    if (filter.status === undefined || filter.status === "cancelled") {
      const cancelledKeys = await this.scanKeys(`${this.prefix}:cancelled:*`);
      for (const key of cancelledKeys) {
        const raw = await this.redis.get(key);
        if (raw !== null) {
          const id = key.replace(`${this.prefix}:cancelled:`, "");
          results.push(fromStoredData(id, JSON.parse(raw) as StoredJobData));
        }
      }
    }

    // Apply filters
    if (filter.type !== undefined) {
      results = results.filter((j) => j.type === filter.type);
    }
    if (filter.status !== undefined) {
      results = results.filter((j) => j.status === filter.status);
    }
    if (filter.systemId !== undefined) {
      results = results.filter((j) => j.systemId === filter.systemId);
    }

    // Sort by priority then createdAt
    results.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.createdAt - b.createdAt;
    });

    // Pagination
    const offset = filter.offset ?? 0;
    const limit = filter.limit;
    return results.slice(offset, limit !== undefined ? offset + limit : undefined);
  }

  async listDeadLettered(
    filter?: Pick<JobFilter, "type" | "systemId" | "limit" | "offset">,
  ): Promise<readonly JobDefinition[]> {
    return this.listJobs({ ...filter, status: "dead-letter" });
  }

  async heartbeat(jobId: JobId): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job === undefined) throw new JobNotFoundError(jobId);

    const hbData = job.data as StoredJobData;
    if (hbData.status !== "running") {
      throw new InvalidJobTransitionError(jobId, hbData.status as JobStatus, "heartbeat");
    }

    const updated: StoredJobData = { ...hbData, lastHeartbeatAt: this.clock() };
    await job.updateData(updated);
  }

  async findStalledJobs(): Promise<readonly JobDefinition[]> {
    const currentTime = this.clock();
    const activeJobs = await this.queue.getJobs(["active"]);

    return activeJobs
      .filter((job) => {
        const d = job.data as StoredJobData;
        if (d.status !== "running") return false;
        const lastBeat = d.lastHeartbeatAt ?? d.startedAt;
        if (lastBeat === null) return false;
        return lastBeat + d.timeoutMs < currentTime;
      })
      .map((j) => fromStoredData(j.id as string, j.data as StoredJobData));
  }

  getRetryPolicy(type: JobType): RetryPolicy {
    return this.retryPolicies.get(type) ?? DEFAULT_RETRY_POLICY;
  }

  setRetryPolicy(type: JobType, policy: RetryPolicy): void {
    this.retryPolicies.set(type, policy);
  }

  setEventHooks(hooks: JobEventHooks): void {
    this.hooks = hooks;
  }

  async countJobs(filter: JobFilter): Promise<number> {
    // Fall back to listJobs when filtering by type or systemId (BullMQ can't filter natively)
    if (filter.type !== undefined || filter.systemId !== undefined) {
      const jobs = await this.listJobs(filter);
      return jobs.length;
    }

    if (filter.status === "cancelled") {
      const keys = await this.scanKeys(`${this.prefix}:cancelled:*`);
      return keys.length;
    }

    if (filter.status !== undefined) {
      const states = this.mapStatusToBullMQStates(filter.status);
      const counts = await this.queue.getJobCounts(...states);
      return Object.values(counts).reduce((sum, n) => sum + n, 0);
    }

    // No filter: sum all BullMQ states + cancelled
    const counts = await this.queue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "prioritized",
    );
    const bullmqTotal = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const cancelledKeys = await this.scanKeys(`${this.prefix}:cancelled:*`);
    return bullmqTotal + cancelledKeys.length;
  }

  // ── Private helpers ──────────────────────────────────────────────

  private async requireBullMQJob(jobId: JobId): Promise<BullMQJob> {
    const job = await this.queue.getJob(jobId);
    if (job === undefined) throw new JobNotFoundError(jobId);
    return job;
  }

  private mapStatusToBullMQStates(
    status?: JobStatus,
  ): ("waiting" | "active" | "completed" | "failed" | "delayed" | "prioritized")[] {
    if (status === undefined) {
      return ["waiting", "active", "completed", "failed", "delayed", "prioritized"];
    }
    switch (status) {
      case "pending":
        return ["waiting", "delayed", "prioritized"];
      case "running":
        return ["active"];
      case "completed":
        return ["completed"];
      case "dead-letter":
        return ["failed"];
      case "cancelled":
        return []; // Handled separately via Redis
      default: {
        const _exhaustive: never = status;
        return _exhaustive;
      }
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        SCAN_COUNT,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== "0");
    return keys;
  }
}
