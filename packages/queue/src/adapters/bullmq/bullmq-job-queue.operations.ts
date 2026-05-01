/**
 * Larger {@link BullMQJobQueue} operations extracted from the main class
 * to keep the class file under the area LOC ceiling. Each function takes
 * an explicit `OperationContext` so it can be unit-tested without spinning
 * up a real queue instance.
 */
import { brandId, extractErrorMessage } from "@pluralscape/types";
import { createId } from "@pluralscape/types/runtime";

import { IdempotencyConflictError } from "../../errors.js";
import { DEFAULT_TIMEOUT_MS, IDEM_RESERVATION_TTL_SEC } from "../../queue.constants.js";

import { CancelledJobStore } from "./bullmq-cancelled-store.js";
import {
  jobIdOf,
  mapStatusToBullMQStates,
  parseJobDataOrThrow,
} from "./bullmq-job-queue.helpers.js";
import { fromStoredData, type StoredJobData } from "./job-mapper.js";

import type { JobEnqueueParams, JobFilter } from "../../types.js";
import type {
  JobDefinition,
  JobId,
  JobType,
  Logger,
  RetryPolicy,
  UnixMillis,
} from "@pluralscape/types";
import type { Queue } from "bullmq";
import type IORedis from "ioredis";

/** Slim view of {@link BullMQJobQueue} that operations need. */
export interface OperationContext {
  readonly redis: IORedis;
  readonly queue: Queue;
  readonly prefix: string;
  readonly logger: Logger;
  readonly clock: () => UnixMillis;
  readonly cancelledStore: CancelledJobStore;
  readonly getRetryPolicy: (type: JobType) => RetryPolicy;
  readonly getJob: (id: JobId) => Promise<JobDefinition | null>;
}

/**
 * Atomic SET-NX reservation guard. Returns whether we won the reservation
 * (true) or a prior key already exists (false). When false, callers should
 * inspect the existing job to decide whether re-enqueue is allowed.
 */
async function reserveIdempotencyKey(
  redis: IORedis,
  idemKey: string,
): Promise<{ reserved: boolean }> {
  const nxResult = await redis.set(idemKey, "reserving", "EX", IDEM_RESERVATION_TTL_SEC, "NX");
  return { reserved: nxResult !== null };
}

/**
 * Build the on-wire {@link StoredJobData} for a freshly enqueued job. Pure
 * function: every field is derived from the input params + clock + policy.
 */
function buildEnqueueData<T extends JobType>(
  params: JobEnqueueParams<T>,
  policy: RetryPolicy,
  currentTime: UnixMillis,
): StoredJobData {
  return {
    systemId: params.systemId ?? null,
    type: params.type,
    payload: params.payload as Record<string, unknown>,
    status: "pending",
    attempts: 0,
    maxAttempts: params.maxAttempts ?? policy.maxRetries + 1,
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
}

/** Enqueue a job with idempotent reservation, atomic add, and key cleanup on failure. */
export async function performEnqueue<T extends JobType>(
  ctx: OperationContext,
  params: JobEnqueueParams<T>,
): Promise<JobDefinition> {
  const idemKey = `${ctx.prefix}:idem:${params.idempotencyKey}`;
  const { reserved } = await reserveIdempotencyKey(ctx.redis, idemKey);

  if (!reserved) {
    const existingId = await ctx.redis.get(idemKey);
    if (existingId !== null && existingId !== "reserving") {
      const existing = await ctx.getJob(brandId<JobId>(existingId));
      if (existing !== null && existing.status !== "completed" && existing.status !== "cancelled") {
        throw new IdempotencyConflictError(params.idempotencyKey);
      }
    } else if (existingId === "reserving") {
      throw new IdempotencyConflictError(params.idempotencyKey);
    }
  }

  const id = brandId<JobId>(createId("job_"));
  const currentTime = ctx.clock();
  const policy = ctx.getRetryPolicy(params.type);
  const data = buildEnqueueData(params, policy, currentTime);

  const delay =
    params.scheduledFor !== undefined ? Math.max(0, params.scheduledFor - currentTime) : 0;

  try {
    await ctx.queue.add(params.type, data, {
      jobId: id,
      priority: params.priority ?? 0,
      delay,
    });
  } catch (err) {
    if (reserved) {
      await ctx.redis.del(idemKey);
    }
    throw err;
  }

  try {
    await ctx.redis.set(idemKey, id);
  } catch (err) {
    ctx.logger.error("queue.idem-key-update-failed", {
      jobId: id,
      error: extractErrorMessage(err),
    });
    try {
      await ctx.redis.del(idemKey);
    } catch (delErr) {
      ctx.logger.warn("queue.idem-key-cleanup-failed", {
        idemKey,
        error: extractErrorMessage(delErr),
      });
    }
    throw err;
  }

  return fromStoredData(id, data);
}

/** List jobs across BullMQ + cancelled-store, applying filter/sort/pagination. */
export async function performListJobs(
  ctx: OperationContext,
  filter: JobFilter,
): Promise<readonly JobDefinition[]> {
  const bullmqStates = mapStatusToBullMQStates(filter.status);
  const bullmqJobs = bullmqStates.length > 0 ? await ctx.queue.getJobs(bullmqStates) : [];

  // Same fail-closed contract as getJob: malformed stored data surfaces as
  // QueueCorruptionError, never a silently-malformed JobDefinition.
  const allJobs: JobDefinition[] = bullmqJobs.map((j) =>
    fromStoredData(jobIdOf(j), parseJobDataOrThrow(j)),
  );

  if (filter.status === undefined || filter.status === "cancelled") {
    const cancelled = await ctx.cancelledStore.scanAllSafe((id) => {
      ctx.logger.warn("Corrupt cancelled job data, skipping", { jobId: id });
    });
    for (const { id, data } of cancelled) {
      allJobs.push(fromStoredData(id, data));
    }
  }

  const filtered = allJobs.filter((j) => {
    if (filter.type !== undefined && j.type !== filter.type) return false;
    if (filter.status !== undefined && j.status !== filter.status) return false;
    if (filter.systemId !== undefined && j.systemId !== filter.systemId) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.createdAt - b.createdAt;
  });

  const offset = filter.offset ?? 0;
  const limit = filter.limit;
  return filtered.slice(offset, limit !== undefined ? offset + limit : undefined);
}
