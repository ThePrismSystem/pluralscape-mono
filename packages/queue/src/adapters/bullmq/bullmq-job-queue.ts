import { brandId, extractErrorMessage, toUnixMillis } from "@pluralscape/types";
import { createId, now } from "@pluralscape/types/runtime";
import { Queue, Worker } from "bullmq";

import { InvalidJobTransitionError, JobNotFoundError, QueueCorruptionError } from "../../errors.js";
import { fireHook } from "../../fire-hook.js";
import { calculateBackoff, DEFAULT_RETRY_POLICY } from "../../policies/index.js";
import { MAX_DEQUEUE_BATCH, PUT_BACK_DELAY_MS } from "../../queue.constants.js";

import { CancelledJobStore } from "./bullmq-cancelled-store.js";
import {
  extractRedisOptions,
  jobIdOf,
  mapStatusToBullMQStates,
  parseJobDataOrThrow,
  scanRedisKeys,
} from "./bullmq-job-queue.helpers.js";
import {
  performEnqueue,
  performListJobs,
  type OperationContext,
} from "./bullmq-job-queue.operations.js";
import { fromStoredData } from "./job-mapper.js";

import type { StoredJobData } from "./job-mapper.js";
import type { JobEventHooks } from "../../event-hooks.js";
import type { JobQueue } from "../../job-queue.js";
import type { IdempotencyCheckResult, JobEnqueueParams, JobFilter } from "../../types.js";
import type {
  JobDefinition,
  JobId,
  JobResult,
  JobType,
  Logger,
  RetryPolicy,
  UnixMillis,
} from "@pluralscape/types";
import type { Job as BullMQJob } from "bullmq";
import type IORedis from "ioredis";
import type { RedisOptions } from "ioredis";

/**
 * BullMQ-backed implementation of JobQueue.
 *
 * Uses a single BullMQ queue with our JobDefinition embedded in job data.
 * Cancelled jobs are stored in a Redis hash via {@link CancelledJobStore}
 * since BullMQ has no native cancel state. Idempotency is tracked via
 * dedicated Redis keys.
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
  private readonly cancelledStore: CancelledJobStore;
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
    this.cancelledStore = new CancelledJobStore(connection, this.prefix);
    this.connOpts = extractRedisOptions(connection);

    this.queue = new Queue(queueName, {
      connection: this.connOpts,
      defaultJobOptions: {
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 1, // We handle retries ourselves
      },
    });

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

  async close(): Promise<void> {
    if (this.fetchWorker !== null) {
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

  async obliterate(): Promise<void> {
    await this.cancelledStore.deleteAll();
    const idemKeys = await scanRedisKeys(this.redis, `${this.prefix}:idem:*`);
    if (idemKeys.length > 0) {
      await this.redis.del(...idemKeys);
    }
    await this.queue.obliterate({ force: true });
  }

  async enqueue<T extends JobType>(params: JobEnqueueParams<T>): Promise<JobDefinition> {
    return performEnqueue(this.operationContext(), params);
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
   */
  async dequeue(types?: readonly JobType[]): Promise<JobDefinition | null> {
    const currentTime = this.clock();

    const putBack: BullMQJob[] = [];
    let result: JobDefinition | null = null;

    const fetchWorker = this.ensureFetchWorker();
    try {
      for (let i = 0; i < MAX_DEQUEUE_BATCH; i++) {
        const job = (await fetchWorker.getNextJob(this.token)) as BullMQJob | undefined;
        if (job === undefined) break;

        const def = parseJobDataOrThrow(job);
        if (types !== undefined && !types.includes(def.type)) {
          putBack.push(job);
          continue;
        }

        if (def.scheduledFor !== null && def.scheduledFor > currentTime) {
          putBack.push(job);
          continue;
        }

        if (def.nextRetryAt !== null && def.nextRetryAt > currentTime) {
          putBack.push(job);
          continue;
        }

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
    const def = parseJobDataOrThrow(job);

    if (def.status !== "running") {
      throw new InvalidJobTransitionError(jobId, def.status, "acknowledge");
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
    const def = parseJobDataOrThrow(job);

    if (def.status !== "running") {
      throw new InvalidJobTransitionError(jobId, def.status, "fail");
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
    const cancelled = await this.cancelledStore.read(jobId);
    if (cancelled !== null) {
      if (cancelled.status !== "dead-letter") {
        throw new InvalidJobTransitionError(jobId, cancelled.status, "retry");
      }
      const updated: StoredJobData = {
        ...cancelled,
        status: "pending",
        attempts: 0,
        error: null,
        nextRetryAt: null,
      };
      await this.queue.add(cancelled.type, updated, { jobId });
      await this.cancelledStore.delete(jobId);
      return fromStoredData(jobId, updated);
    }

    const job = await this.queue.getJob(jobId);
    if (job === undefined) throw new JobNotFoundError(jobId);

    const def = parseJobDataOrThrow(job);
    if (def.status !== "dead-letter") {
      throw new InvalidJobTransitionError(jobId, def.status, "retry");
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
    const cancelled = await this.cancelledStore.read(jobId);
    if (cancelled !== null) {
      if (cancelled.status === "completed") {
        throw new InvalidJobTransitionError(jobId, "completed", "cancel");
      }
      const updated: StoredJobData = { ...cancelled, status: "cancelled" };
      await this.cancelledStore.write(jobId, updated);
      return fromStoredData(jobId, updated);
    }

    const job = await this.queue.getJob(jobId);
    if (job === undefined) throw new JobNotFoundError(jobId);

    const def = parseJobDataOrThrow(job);
    if (def.status === "completed") {
      throw new InvalidJobTransitionError(jobId, "completed", "cancel");
    }

    const updated: StoredJobData = { ...def, status: "cancelled" };
    await this.cancelledStore.write(jobId, updated);
    await job.remove();

    return fromStoredData(jobId, updated);
  }

  async getJob(jobId: JobId): Promise<JobDefinition | null> {
    // BullMQ calls `JSON.parse(json.data)` inside Job.fromJSON, so a malformed
    // `data` field surfaces as a raw SyntaxError from the SDK. Wrap that path
    // so callers always see a typed QueueCorruptionError.
    let job: BullMQJob | undefined;
    try {
      job = await this.queue.getJob(jobId);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new QueueCorruptionError(jobId, extractErrorMessage(err), { cause: err });
      }
      throw err;
    }
    if (job !== undefined) {
      return fromStoredData(jobIdOf(job), parseJobDataOrThrow(job));
    }

    const cancelled = await this.cancelledStore.read(jobId);
    if (cancelled !== null) {
      return fromStoredData(jobId, cancelled);
    }
    return null;
  }

  async listJobs(filter: JobFilter): Promise<readonly JobDefinition[]> {
    return performListJobs(this.operationContext(), filter);
  }

  async listDeadLettered(
    filter?: Pick<JobFilter, "type" | "systemId" | "limit" | "offset">,
  ): Promise<readonly JobDefinition[]> {
    return this.listJobs({ ...filter, status: "dead-letter" });
  }

  async heartbeat(jobId: JobId): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job === undefined) throw new JobNotFoundError(jobId);

    const hbData = parseJobDataOrThrow(job);
    if (hbData.status !== "running") {
      throw new InvalidJobTransitionError(jobId, hbData.status, "heartbeat");
    }

    const updated: StoredJobData = { ...hbData, lastHeartbeatAt: this.clock() };
    await job.updateData(updated);
  }

  /**
   * Return every active job whose last heartbeat + timeout is in the past.
   *
   * **Fail-closed blast radius:** a single corrupt active job aborts the
   * entire sweep with {@link QueueCorruptionError}. Schedulers calling this
   * periodically MUST supervise that error — alert an operator, open a
   * ticket, quarantine the bad key — rather than re-invoke blindly, since
   * the corrupt record will keep tripping the guard until it is repaired
   * or removed.
   */
  async findStalledJobs(): Promise<readonly JobDefinition[]> {
    const currentTime = this.clock();
    const activeJobs = await this.queue.getJobs(["active"]);

    return activeJobs
      .map((job) => ({ job, data: parseJobDataOrThrow(job) }))
      .filter(({ data }) => {
        if (data.status !== "running") return false;
        const lastBeat = data.lastHeartbeatAt ?? data.startedAt;
        if (lastBeat === null) return false;
        return lastBeat + data.timeoutMs < currentTime;
      })
      .map(({ job, data }) => fromStoredData(jobIdOf(job), data));
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
    if (filter.type !== undefined || filter.systemId !== undefined) {
      const jobs = await this.listJobs(filter);
      return jobs.length;
    }

    if (filter.status === "cancelled") {
      const ids = await this.cancelledStore.scanIds();
      return ids.length;
    }

    if (filter.status !== undefined) {
      const states = mapStatusToBullMQStates(filter.status);
      const counts = await this.queue.getJobCounts(...states);
      return Object.values(counts).reduce((sum, n) => sum + n, 0);
    }

    const counts = await this.queue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
      "prioritized",
    );
    const bullmqTotal = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const cancelledIds = await this.cancelledStore.scanIds();
    return bullmqTotal + cancelledIds.length;
  }

  private async requireBullMQJob(jobId: JobId): Promise<BullMQJob> {
    const job = await this.queue.getJob(jobId);
    if (job === undefined) throw new JobNotFoundError(jobId);
    return job;
  }

  /**
   * Snapshot of class state needed by extracted operations. Bound delegates
   * are captured here so the operation functions don't need access to
   * private members of the class instance.
   */
  private operationContext(): OperationContext {
    return {
      redis: this.redis,
      queue: this.queue,
      prefix: this.prefix,
      logger: this.logger,
      clock: this.clock,
      cancelledStore: this.cancelledStore,
      getRetryPolicy: (type) => this.getRetryPolicy(type),
      getJob: (id) => this.getJob(id),
    };
  }
}
