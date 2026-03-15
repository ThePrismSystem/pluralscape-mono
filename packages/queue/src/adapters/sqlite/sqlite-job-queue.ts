import { jobs } from "@pluralscape/db/sqlite";
import { createId, now } from "@pluralscape/types/runtime";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";

import {
  IdempotencyConflictError,
  InvalidJobTransitionError,
  JobNotFoundError,
} from "../../errors.js";
import { fireHook } from "../../fire-hook.js";
import { calculateBackoff, DEFAULT_RETRY_POLICY } from "../../policies/index.js";

import { rowToJob } from "./row-mapper.js";

import type { JobEventHooks } from "../../event-hooks.js";
import type { JobQueue } from "../../job-queue.js";
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
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Wraps a synchronous function in a Promise, ensuring thrown errors
 * become rejected promises rather than synchronous exceptions.
 */
function asPromise<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (err) {
    return Promise.reject(err as Error);
  }
}

/**
 * SQLite-backed implementation of JobQueue using Drizzle ORM.
 *
 * Single-process only — dequeue atomicity relies on SQLite's single-writer model.
 */
export class SqliteJobQueue implements JobQueue {
  private readonly retryPolicies = new Map<JobType, RetryPolicy>();
  private hooks: JobEventHooks = {};
  private readonly clock: () => UnixMillis;

  constructor(
    private readonly db: BetterSQLite3Database,
    clock?: () => UnixMillis,
  ) {
    this.clock = clock ?? now;
  }

  enqueue<T extends JobType>(params: JobEnqueueParams<T>): Promise<JobDefinition> {
    return asPromise(() =>
      this.db.transaction((tx) => {
        const existing = tx
          .select()
          .from(jobs)
          .where(eq(jobs.idempotencyKey, params.idempotencyKey))
          .get();

        if (existing !== undefined) {
          if (existing.status !== "completed" && existing.status !== "cancelled") {
            throw new IdempotencyConflictError(params.idempotencyKey);
          }
          tx.update(jobs).set({ idempotencyKey: null }).where(eq(jobs.id, existing.id)).run();
        }

        const id = createId("job_") as JobId;
        const currentTime = this.clock();
        const policy = this.getRetryPolicy(params.type);
        const maxAttempts = params.maxAttempts ?? policy.maxRetries + 1;

        tx.insert(jobs)
          .values({
            id,
            systemId: params.systemId ?? null,
            type: params.type,
            payload: params.payload,
            status: "pending" as JobStatus,
            attempts: 0,
            maxAttempts,
            nextRetryAt: null,
            error: null,
            createdAt: currentTime,
            startedAt: null,
            completedAt: null,
            idempotencyKey: params.idempotencyKey,
            lastHeartbeatAt: null,
            timeoutMs: params.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            result: null,
            scheduledFor: params.scheduledFor ?? null,
            priority: params.priority ?? 0,
          })
          .run();

        const row = tx.select().from(jobs).where(eq(jobs.id, id)).get();
        if (row === undefined) throw new Error("Failed to read back enqueued job");
        return rowToJob(row);
      }),
    );
  }

  checkIdempotency(key: string): Promise<IdempotencyCheckResult> {
    return asPromise(() => {
      const row = this.db.select().from(jobs).where(eq(jobs.idempotencyKey, key)).get();
      if (row === undefined) return { exists: false as const };
      return { exists: true as const, existingJob: rowToJob(row) };
    });
  }

  dequeue(types?: readonly JobType[]): Promise<JobDefinition | null> {
    return asPromise(() => {
      const currentTime = this.clock();

      return this.db.transaction((tx) => {
        const conditions = [
          eq(jobs.status, "pending" as JobStatus),
          or(isNull(jobs.scheduledFor), lte(jobs.scheduledFor, currentTime)),
          or(isNull(jobs.nextRetryAt), lte(jobs.nextRetryAt, currentTime)),
        ];

        if (types !== undefined && types.length > 0) {
          const typeConditions = types.map((t) => eq(jobs.type, t));
          const typeOr = or(...typeConditions);
          if (typeOr !== undefined) conditions.push(typeOr);
        }

        const row = tx
          .select()
          .from(jobs)
          .where(and(...conditions))
          .orderBy(jobs.priority, jobs.createdAt)
          .limit(1)
          .get();

        if (row === undefined) return null;

        tx.update(jobs)
          .set({
            status: "running" as JobStatus,
            startedAt: currentTime,
            lastHeartbeatAt: currentTime,
          })
          .where(eq(jobs.id, row.id))
          .run();

        const updated = tx.select().from(jobs).where(eq(jobs.id, row.id)).get();
        if (updated === undefined) return null;
        return rowToJob(updated);
      });
    });
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

    this.db
      .update(jobs)
      .set({
        status: "completed" as JobStatus,
        completedAt: currentTime,
        result: jobResult,
      })
      .where(eq(jobs.id, jobId))
      .run();

    const updated = this.requireJob(jobId);
    await fireHook(this.hooks, "onComplete", updated);
    return updated;
  }

  async fail(jobId: JobId, error: string): Promise<JobDefinition> {
    const job = this.requireJob(jobId);
    if (job.status !== "running") {
      throw new InvalidJobTransitionError(jobId, job.status, "fail");
    }

    const newAttempts = job.attempts + 1;
    const currentTime = this.clock();

    if (newAttempts >= job.maxAttempts) {
      this.db
        .update(jobs)
        .set({
          status: "dead-letter" as JobStatus,
          attempts: newAttempts,
          error,
          result: { success: false, message: error, completedAt: currentTime },
        })
        .where(eq(jobs.id, jobId))
        .run();

      const updated = this.requireJob(jobId);
      await fireHook(this.hooks, "onFail", updated, new Error(error));
      await fireHook(this.hooks, "onDeadLetter", updated);
      return updated;
    }

    const policy = this.getRetryPolicy(job.type);
    const backoff = calculateBackoff(policy, newAttempts);

    this.db
      .update(jobs)
      .set({
        status: "pending" as JobStatus,
        attempts: newAttempts,
        error,
        nextRetryAt: (currentTime + backoff) as UnixMillis,
      })
      .where(eq(jobs.id, jobId))
      .run();

    const updated = this.requireJob(jobId);
    await fireHook(this.hooks, "onFail", updated, new Error(error));
    return updated;
  }

  retry(jobId: JobId): Promise<JobDefinition> {
    return asPromise(() => {
      const row = this.db.select().from(jobs).where(eq(jobs.id, jobId)).get();
      if (row === undefined) throw new JobNotFoundError(jobId);
      const job = rowToJob(row);

      if (job.status !== "dead-letter") {
        throw new InvalidJobTransitionError(jobId, job.status, "retry");
      }

      this.db
        .update(jobs)
        .set({
          status: "pending" as JobStatus,
          error: null,
          nextRetryAt: null,
        })
        .where(eq(jobs.id, jobId))
        .run();

      return this.requireJob(jobId);
    });
  }

  cancel(jobId: JobId): Promise<JobDefinition> {
    return asPromise(() => {
      const row = this.db.select().from(jobs).where(eq(jobs.id, jobId)).get();
      if (row === undefined) throw new JobNotFoundError(jobId);

      if (row.status === "completed") {
        throw new InvalidJobTransitionError(jobId, row.status as JobStatus, "cancel");
      }

      this.db
        .update(jobs)
        .set({ status: "cancelled" as JobStatus })
        .where(eq(jobs.id, jobId))
        .run();

      return this.requireJob(jobId);
    });
  }

  getJob(jobId: JobId): Promise<JobDefinition | null> {
    return asPromise(() => {
      const row = this.db.select().from(jobs).where(eq(jobs.id, jobId)).get();
      if (row === undefined) return null;
      return rowToJob(row);
    });
  }

  listJobs(filter: JobFilter): Promise<readonly JobDefinition[]> {
    return asPromise(() => {
      const conditions = [];

      if (filter.type !== undefined) conditions.push(eq(jobs.type, filter.type));
      if (filter.status !== undefined) conditions.push(eq(jobs.status, filter.status));
      if (filter.systemId !== undefined) conditions.push(eq(jobs.systemId, filter.systemId));

      const query = this.db
        .select()
        .from(jobs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(jobs.priority, jobs.createdAt);

      const offset = filter.offset ?? 0;
      if (offset > 0) query.offset(offset);
      if (filter.limit !== undefined) query.limit(filter.limit);

      return query.all().map(rowToJob);
    });
  }

  listDeadLettered(
    filter?: Pick<JobFilter, "type" | "systemId" | "limit" | "offset">,
  ): Promise<readonly JobDefinition[]> {
    return this.listJobs({ ...filter, status: "dead-letter" });
  }

  heartbeat(jobId: JobId): Promise<void> {
    return asPromise(() => {
      const row = this.db.select().from(jobs).where(eq(jobs.id, jobId)).get();
      if (row === undefined) throw new JobNotFoundError(jobId);
      if (row.status !== "running") {
        throw new InvalidJobTransitionError(jobId, row.status as JobStatus, "heartbeat");
      }
      this.db.update(jobs).set({ lastHeartbeatAt: this.clock() }).where(eq(jobs.id, jobId)).run();
    });
  }

  findStalledJobs(): Promise<readonly JobDefinition[]> {
    return asPromise(() => {
      const currentTime = this.clock();

      const rows = this.db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.status, "running" as JobStatus),
            sql`coalesce(${jobs.lastHeartbeatAt}, ${jobs.startedAt}) + ${jobs.timeoutMs} < ${currentTime}`,
          ),
        )
        .all();

      return rows.map(rowToJob);
    });
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

  countJobs(filter: JobFilter): Promise<number> {
    return asPromise(() => {
      const conditions = [];

      if (filter.type !== undefined) conditions.push(eq(jobs.type, filter.type));
      if (filter.status !== undefined) conditions.push(eq(jobs.status, filter.status));
      if (filter.systemId !== undefined) conditions.push(eq(jobs.systemId, filter.systemId));

      const row = this.db
        .select({ count: sql<number>`count(*)` })
        .from(jobs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .get();

      return row?.count ?? 0;
    });
  }

  // ── Private helpers ──────────────────────────────────────────────

  private requireJob(jobId: JobId): JobDefinition {
    const row = this.db.select().from(jobs).where(eq(jobs.id, jobId)).get();
    if (row === undefined) throw new JobNotFoundError(jobId);
    return rowToJob(row);
  }
}
