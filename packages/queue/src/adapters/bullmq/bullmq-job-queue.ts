import { brandId, extractErrorMessage, toUnixMillis } from "@pluralscape/types";
import { createId, now } from "@pluralscape/types/runtime";
import { Queue, Worker } from "bullmq";
import { z } from "zod";

import {
  IdempotencyConflictError,
  InvalidJobTransitionError,
  JobNotFoundError,
  QueueCorruptionError,
} from "../../errors.js";
import { fireHook } from "../../fire-hook.js";
import { PayloadSchemaByType } from "../../payload-schemas.js";
import { calculateBackoff, DEFAULT_RETRY_POLICY } from "../../policies/index.js";
import {
  DEFAULT_TIMEOUT_MS,
  IDEM_RESERVATION_TTL_SEC,
  MAX_DEQUEUE_BATCH,
  PUT_BACK_DELAY_MS,
  SCAN_COUNT,
} from "../../queue.constants.js";

import { fromStoredData } from "./job-mapper.js";

import type { StoredJobData } from "./job-mapper.js";
import type { JobEventHooks } from "../../event-hooks.js";
import type { JobQueue } from "../../job-queue.js";
import type { IdempotencyCheckResult, JobEnqueueParams, JobFilter } from "../../types.js";
import type {
  JobDefinition,
  JobId,
  JobResult,
  JobStatus,
  JobType,
  Logger,
  RetryPolicy,
  UnixMillis,
} from "@pluralscape/types";
import type { Job as BullMQJob } from "bullmq";
import type IORedis from "ioredis";
import type { RedisOptions } from "ioredis";

const StoredJobDataSchema = z
  .object({
    systemId: z.string().nullable(),
    type: z.string(),
    payload: z.unknown(),
    status: z.string(),
    attempts: z.number(),
    maxAttempts: z.number(),
    nextRetryAt: z.number().nullable(),
    error: z.string().nullable(),
    result: z.unknown().nullable(),
    createdAt: z.number(),
    startedAt: z.number().nullable(),
    completedAt: z.number().nullable(),
    idempotencyKey: z.string().nullable(),
    lastHeartbeatAt: z.number().nullable(),
    timeoutMs: z.number(),
    scheduledFor: z.number().nullable(),
    priority: z.number(),
  })
  .superRefine((data, ctx) => {
    // `data.type` is `string` at the deserialization boundary — look it up via
    // `Object.hasOwn` + a narrowed access so TS treats the index result as
    // possibly-undefined. Casting `data.type as JobType` here would tell TS
    // the access is total and trip `no-unnecessary-condition` on the guard.
    if (!Object.hasOwn(PayloadSchemaByType, data.type)) {
      ctx.addIssue({ code: "custom", message: `Unknown job type: ${data.type}` });
      return;
    }
    const schema = PayloadSchemaByType[data.type as JobType];
    const r = schema.safeParse(data.payload);
    if (!r.success) {
      ctx.addIssue({
        code: "custom",
        message: `Payload mismatch for type ${data.type}: ${r.error.message}`,
      });
    }
  });

function jobIdOf(job: BullMQJob): JobId {
  const id = job.id;
  if (id === undefined) throw new Error("BullMQ job missing id");
  return brandId<JobId>(id);
}

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
  private readonly logger: Logger;
  private readonly queue: Queue;
  private fetchWorker: Worker | null = null;
  private readonly redis: IORedis;
  private readonly prefix: string;
  private readonly token: string;
  private readonly connOpts: RedisOptions;
  readonly name: string;

  constructor(
    queueName: string,
    connection: IORedis,
    options: { logger: Logger; clock?: () => UnixMillis },
  ) {
    this.clock = options.clock ?? now;
    this.logger = options.logger;
    this.redis = connection;
    this.name = queueName;
    this.prefix = `psq:${queueName}`;
    this.token = `token-${createId("tk_")}`;

    // Pass connection config (not the instance) to BullMQ so it creates and
    // fully owns its internal connections. Forwards auth, TLS, db, and
    // sentinel options alongside host/port.
    const { host, port, password, username, db, tls, keyPrefix, sentinels, natMap } =
      connection.options;
    this.connOpts = {
      host,
      port,
      ...(password !== undefined && { password }),
      ...(username !== undefined && { username }),
      ...(db !== undefined && { db }),
      ...(tls !== undefined && { tls }),
      ...(keyPrefix !== undefined && { keyPrefix }),
      ...(sentinels !== undefined && { sentinels }),
      ...(natMap !== undefined && { natMap }),
    };

    this.queue = new Queue(queueName, {
      connection: this.connOpts,
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 1, // We handle retries ourselves
      },
    });

    // Prevent unhandled EventEmitter errors from BullMQ's internal connections
    this.queue.on("error", (err: Error) => {
      this.logger.warn("queue.connection-error", { error: extractErrorMessage(err) });
    });
  }

  /**
   * Lazily creates the fetch worker on first dequeue() call.
   *
   * The fetch worker is a BullMQ Worker with autorun:false, used solely for
   * getNextJob(). Creating it lazily avoids opening ioredis connections that
   * may never be used — which prevents "Connection is closed" unhandled
   * rejections when close() is called before the connections finish initializing.
   */
  private ensureFetchWorker(): Worker {
    if (this.fetchWorker === null) {
      this.fetchWorker = new Worker(this.name, undefined, {
        connection: this.connOpts,
        autorun: false,
      });
      this.fetchWorker.on("error", (err: Error) => {
        this.logger.warn("queue.fetch-worker-error", { error: extractErrorMessage(err) });
      });
    }
    return this.fetchWorker;
  }

  /** Closes BullMQ queue and worker connections. Call during cleanup. */
  async close(): Promise<void> {
    if (this.fetchWorker !== null) {
      // Wait for connections to finish initializing before closing. If closed
      // while still initializing, BullMQ may use ioredis.disconnect() which
      // rejects pending init commands as unhandled promise rejections.
      await this.fetchWorker.waitUntilReady().catch(() => undefined);
      try {
        await this.fetchWorker.close();
      } catch (err) {
        this.logger.warn("queue.close-worker-error", { error: extractErrorMessage(err) });
      }
    }
    await this.queue.waitUntilReady().catch(() => undefined);
    try {
      await this.queue.close();
    } catch (err) {
      this.logger.warn("queue.close-queue-error", { error: extractErrorMessage(err) });
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
        const existing = await this.getJob(brandId<JobId>(existingId));
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

    const id = brandId<JobId>(createId("job_"));
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
      this.logger.error("queue.idem-key-update-failed", {
        jobId: id,
        error: extractErrorMessage(err),
      });
      try {
        await this.redis.del(idemKey);
      } catch (delErr) {
        this.logger.warn("queue.idem-key-cleanup-failed", {
          idemKey,
          error: extractErrorMessage(delErr),
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
    const job = await this.getJob(brandId<JobId>(jobId));
    if (job === null) return { exists: false };
    return { exists: true, existingJob: job };
  }

  /**
   * Dequeues the next eligible job.
   *
   * **Client-side type filtering:** BullMQ does not support server-side type
   * filtering — `Worker.getNextJob()` pulls the next available job from the
   * queue regardless of job data. The `types` filter is therefore applied
   * client-side: non-matching jobs are fetched and put back via
   * `moveToDelayed`. This means type-filtered dequeue does not guarantee
   * strict priority ordering across all job types — only among the jobs
   * inspected in a single call (up to {@link MAX_DEQUEUE_BATCH}).
   *
   * An alternative would be separate queues per job type, but that adds
   * operational complexity (more Redis keys, per-queue workers) without
   * meaningful benefit at our current scale.
   */
  async dequeue(types?: readonly JobType[]): Promise<JobDefinition | null> {
    const currentTime = this.clock();

    // Fetch jobs from BullMQ, putting back non-matching ones
    const putBack: BullMQJob[] = [];
    let result: JobDefinition | null = null;

    const fetchWorker = this.ensureFetchWorker();
    try {
      for (let i = 0; i < MAX_DEQUEUE_BATCH; i++) {
        // getNextJob may return undefined when no jobs available
        const job = (await fetchWorker.getNextJob(this.token)) as BullMQJob | undefined;
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
        result = fromStoredData(jobIdOf(job), updated);
        break;
      }
    } finally {
      // Put back non-matching jobs
      for (const job of putBack) {
        try {
          await job.moveToDelayed(this.clock() + PUT_BACK_DELAY_MS, this.token);
        } catch (err) {
          this.logger.warn("queue.dequeue-putback-error", {
            jobId: job.id,
            error: extractErrorMessage(err),
          });
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
      nextRetryAt: toUnixMillis(currentTime + backoff),
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
      let parsed: StoredJobData;
      try {
        parsed = StoredJobDataSchema.parse(JSON.parse(cancelledRaw)) as StoredJobData;
      } catch (err) {
        throw new QueueCorruptionError(jobId, { cause: err });
      }
      if (parsed.status !== "dead-letter") {
        throw new InvalidJobTransitionError(jobId, parsed.status, "retry");
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
      let parsed: StoredJobData;
      try {
        parsed = StoredJobDataSchema.parse(JSON.parse(cancelledRaw)) as StoredJobData;
      } catch (err) {
        throw new QueueCorruptionError(jobId, { cause: err });
      }
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
    // Check BullMQ first. BullMQ calls `JSON.parse(json.data)` inside Job.fromJSON,
    // so a malformed `data` field surfaces as a raw SyntaxError from the SDK.
    // Wrap that path so callers always see a typed QueueCorruptionError.
    let job: BullMQJob | undefined;
    try {
      job = await this.queue.getJob(jobId);
    } catch (err) {
      if (err instanceof SyntaxError) throw new QueueCorruptionError(jobId, { cause: err });
      throw err;
    }
    if (job !== undefined) {
      // Validate the deserialized shape — BullMQ happily returns partial data
      // if fields were never stored, which would produce a silently-malformed
      // JobDefinition downstream.
      const parseResult = StoredJobDataSchema.safeParse(job.data);
      if (!parseResult.success) {
        throw new QueueCorruptionError(jobId, { cause: parseResult.error });
      }
      return fromStoredData(jobIdOf(job), parseResult.data as StoredJobData);
    }

    // Check cancelled store
    const cancelledRaw = await this.redis.get(`${this.prefix}:cancelled:${jobId}`);
    if (cancelledRaw !== null) {
      let parsed: StoredJobData;
      try {
        parsed = StoredJobDataSchema.parse(JSON.parse(cancelledRaw)) as StoredJobData;
      } catch (err) {
        throw new QueueCorruptionError(jobId, { cause: err });
      }
      return fromStoredData(jobId, parsed);
    }

    return null;
  }

  async listJobs(filter: JobFilter): Promise<readonly JobDefinition[]> {
    // Collect all jobs from BullMQ + cancelled store
    const bullmqStates = this.mapStatusToBullMQStates(filter.status);
    const bullmqJobs = bullmqStates.length > 0 ? await this.queue.getJobs(bullmqStates) : [];

    const allJobs: JobDefinition[] = bullmqJobs.map((j) => {
      // Same fail-closed contract as getJob: a mismatched (type, payload) or
      // missing field in the stored data must surface as QueueCorruptionError
      // rather than silently yielding a malformed JobDefinition to callers.
      const parseResult = StoredJobDataSchema.safeParse(j.data);
      if (!parseResult.success) {
        throw new QueueCorruptionError(jobIdOf(j), { cause: parseResult.error });
      }
      return fromStoredData(jobIdOf(j), parseResult.data as StoredJobData);
    });

    if (filter.status === undefined || filter.status === "cancelled") {
      const cancelledKeys = await this.scanKeys(`${this.prefix}:cancelled:*`);
      for (const key of cancelledKeys) {
        const raw = await this.redis.get(key);
        if (raw !== null) {
          const id = brandId<JobId>(key.replace(`${this.prefix}:cancelled:`, ""));
          try {
            allJobs.push(
              fromStoredData(id, StoredJobDataSchema.parse(JSON.parse(raw)) as StoredJobData),
            );
          } catch {
            this.logger.warn("Corrupt cancelled job data, skipping", { jobId: id });
          }
        }
      }
    }

    // Single-pass filter
    const filtered = allJobs.filter((j) => {
      if (filter.type !== undefined && j.type !== filter.type) return false;
      if (filter.status !== undefined && j.status !== filter.status) return false;
      if (filter.systemId !== undefined && j.systemId !== filter.systemId) return false;
      return true;
    });

    // Sort by priority then createdAt
    filtered.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.createdAt - b.createdAt;
    });

    // Pagination
    const offset = filter.offset ?? 0;
    const limit = filter.limit;
    return filtered.slice(offset, limit !== undefined ? offset + limit : undefined);
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
      .map((j) => fromStoredData(jobIdOf(j), j.data as StoredJobData));
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
