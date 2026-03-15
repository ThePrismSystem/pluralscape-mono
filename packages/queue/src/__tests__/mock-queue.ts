import { createId, now } from "@pluralscape/types/runtime";

import {
  IdempotencyConflictError,
  InvalidJobTransitionError,
  JobNotFoundError,
} from "../errors.js";

import type { JobEventHooks } from "../event-hooks.js";
import type { JobQueue } from "../job-queue.js";
import type { IdempotencyCheckResult, JobEnqueueParams, JobFilter } from "../types.js";
import type {
  JobDefinition,
  JobId,
  JobResult,
  JobType,
  RetryPolicy,
  UnixMillis,
} from "@pluralscape/types";

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  backoffMs: 1_000,
  backoffMultiplier: 2,
  maxBackoffMs: 30_000,
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ATTEMPTS = 4;

function priorityThenCreatedAt(a: JobDefinition, b: JobDefinition): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.createdAt - b.createdAt;
}

/**
 * In-memory implementation of JobQueue for use in contract tests.
 *
 * Accepts an injectable clock (defaults to `now()`) for time-dependent test scenarios.
 */
export class InMemoryJobQueue implements JobQueue {
  private readonly jobs = new Map<string, JobDefinition>();
  /** Maps idempotency key → job ID (all statuses — GC'd only on completed re-enqueue) */
  private readonly idempotencyIndex = new Map<string, string>();
  private readonly retryPolicies = new Map<JobType, RetryPolicy>();
  private hooks: JobEventHooks = {};
  readonly clock: () => UnixMillis;

  constructor(clock?: () => UnixMillis) {
    this.clock = clock ?? now;
  }

  enqueue(params: JobEnqueueParams): Promise<JobDefinition> {
    const existingId = this.idempotencyIndex.get(params.idempotencyKey);
    if (existingId !== undefined) {
      const existing = this.jobs.get(existingId);
      if (
        existing !== undefined &&
        existing.status !== "completed" &&
        existing.status !== "cancelled"
      ) {
        return Promise.reject(new IdempotencyConflictError(params.idempotencyKey));
      }
    }

    const id = createId("job_") as JobId;
    const job: JobDefinition = {
      id,
      systemId: params.systemId ?? null,
      type: params.type,
      status: "pending",
      payload: params.payload,
      attempts: 0,
      maxAttempts: params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      nextRetryAt: null,
      error: null,
      result: null,
      createdAt: this.clock(),
      startedAt: null,
      completedAt: null,
      idempotencyKey: params.idempotencyKey,
      lastHeartbeatAt: null,
      timeoutMs: params.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      scheduledFor: params.scheduledFor ?? null,
      priority: params.priority ?? 0,
    };

    this.jobs.set(id, job);
    this.idempotencyIndex.set(params.idempotencyKey, id);
    return Promise.resolve(job);
  }

  checkIdempotency(key: string): Promise<IdempotencyCheckResult> {
    const jobId = this.idempotencyIndex.get(key);
    if (jobId === undefined) {
      return Promise.resolve({ exists: false });
    }
    const job = this.jobs.get(jobId);
    if (job === undefined) {
      return Promise.resolve({ exists: false });
    }
    return Promise.resolve({ exists: true, existingJob: job });
  }

  dequeue(types?: readonly JobType[]): Promise<JobDefinition | null> {
    const currentTime = this.clock();
    const candidates = Array.from(this.jobs.values())
      .filter((j) => {
        if (j.status !== "pending") return false;
        if (j.scheduledFor !== null && j.scheduledFor > currentTime) return false;
        if (j.nextRetryAt !== null && j.nextRetryAt > currentTime) return false;
        if (types !== undefined && !types.includes(j.type)) return false;
        return true;
      })
      .sort(priorityThenCreatedAt);

    const next = candidates[0];
    if (next === undefined) return Promise.resolve(null);

    const running: JobDefinition = {
      ...next,
      status: "running",
      startedAt: currentTime,
      lastHeartbeatAt: currentTime,
    };
    this.jobs.set(running.id, running);
    return Promise.resolve(running);
  }

  async acknowledge(jobId: JobId, result: { message?: string }): Promise<JobDefinition> {
    const job = this.requireJob(jobId);
    if (job.status !== "running") {
      throw new InvalidJobTransitionError(jobId, job.status, "acknowledge");
    }
    const currentTime = this.clock();
    const jobResult: JobResult = {
      success: true,
      message: result.message ?? null,
      completedAt: currentTime,
    };
    const completed: JobDefinition = {
      ...job,
      status: "completed",
      completedAt: currentTime,
      result: jobResult,
    };
    this.jobs.set(jobId, completed);
    await this.fireHook("onComplete", completed);
    return completed;
  }

  async fail(jobId: JobId, error: string): Promise<JobDefinition> {
    const job = this.requireJob(jobId);
    if (job.status !== "running") {
      throw new InvalidJobTransitionError(jobId, job.status, "fail");
    }
    const newAttempts = job.attempts + 1;
    const currentTime = this.clock();

    let updated: JobDefinition;

    if (newAttempts >= job.maxAttempts) {
      updated = {
        ...job,
        status: "dead-letter",
        attempts: newAttempts,
        error,
        result: { success: false, message: error, completedAt: currentTime },
      };
      this.jobs.set(jobId, updated);
      await this.fireHook("onFail", updated, new Error(error));
      await this.fireHook("onDeadLetter", updated);
    } else {
      const policy = this.getRetryPolicy(job.type);
      const backoff = Math.min(
        policy.backoffMs * Math.pow(policy.backoffMultiplier, newAttempts - 1),
        policy.maxBackoffMs,
      );
      updated = {
        ...job,
        status: "pending",
        attempts: newAttempts,
        error,
        nextRetryAt: (currentTime + backoff) as UnixMillis,
      };
      this.jobs.set(jobId, updated);
      await this.fireHook("onFail", updated, new Error(error));
    }

    return updated;
  }

  retry(jobId: JobId): Promise<JobDefinition> {
    const job = this.jobs.get(jobId);
    if (job === undefined) return Promise.reject(new JobNotFoundError(jobId));
    if (job.status !== "failed" && job.status !== "dead-letter") {
      return Promise.reject(new InvalidJobTransitionError(jobId, job.status, "retry"));
    }
    const retried: JobDefinition = {
      ...job,
      status: "pending",
      error: null,
      nextRetryAt: null,
    };
    this.jobs.set(jobId, retried);
    return Promise.resolve(retried);
  }

  cancel(jobId: JobId): Promise<JobDefinition> {
    const job = this.jobs.get(jobId);
    if (job === undefined) return Promise.reject(new JobNotFoundError(jobId));
    if (job.status === "completed" || job.status === "dead-letter") {
      return Promise.reject(new InvalidJobTransitionError(jobId, job.status, "cancel"));
    }
    const cancelled: JobDefinition = { ...job, status: "cancelled" };
    this.jobs.set(jobId, cancelled);
    return Promise.resolve(cancelled);
  }

  getJob(jobId: JobId): Promise<JobDefinition | null> {
    return Promise.resolve(this.jobs.get(jobId) ?? null);
  }

  listJobs(filter: JobFilter): Promise<readonly JobDefinition[]> {
    let results = Array.from(this.jobs.values());

    if (filter.type !== undefined) {
      results = results.filter((j) => j.type === filter.type);
    }
    if (filter.status !== undefined) {
      results = results.filter((j) => j.status === filter.status);
    }
    if (filter.systemId !== undefined) {
      results = results.filter((j) => j.systemId === filter.systemId);
    }

    results.sort(priorityThenCreatedAt);

    const offset = filter.offset ?? 0;
    const limit = filter.limit;
    const sliced = results.slice(offset, limit !== undefined ? offset + limit : undefined);
    return Promise.resolve(sliced);
  }

  listDeadLettered(
    filter?: Pick<JobFilter, "type" | "systemId" | "limit" | "offset">,
  ): Promise<readonly JobDefinition[]> {
    return this.listJobs({ ...filter, status: "dead-letter" });
  }

  heartbeat(jobId: JobId): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job === undefined) return Promise.reject(new JobNotFoundError(jobId));
    if (job.status !== "running") {
      return Promise.reject(new InvalidJobTransitionError(jobId, job.status, "heartbeat"));
    }
    this.jobs.set(jobId, { ...job, lastHeartbeatAt: this.clock() });
    return Promise.resolve();
  }

  findStalledJobs(): Promise<readonly JobDefinition[]> {
    const currentTime = this.clock();
    const stalled = Array.from(this.jobs.values()).filter((j) => {
      if (j.status !== "running") return false;
      const lastBeat = j.lastHeartbeatAt ?? j.startedAt;
      if (lastBeat === null) return false;
      return lastBeat + j.timeoutMs < currentTime;
    });
    return Promise.resolve(stalled);
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

  // ── Private helpers ──────────────────────────────────────────────

  private requireJob(jobId: JobId): JobDefinition {
    const job = this.jobs.get(jobId);
    if (job === undefined) throw new JobNotFoundError(jobId);
    return job;
  }

  private async fireHook(
    event: keyof JobEventHooks,
    job: JobDefinition,
    error?: Error,
  ): Promise<void> {
    try {
      if (event === "onComplete") {
        await this.hooks.onComplete?.(job);
      } else if (event === "onFail" && error !== undefined) {
        await this.hooks.onFail?.(job, error);
      } else if (event === "onDeadLetter") {
        await this.hooks.onDeadLetter?.(job);
      }
    } catch {
      // Hook errors must not propagate
    }
  }
}
