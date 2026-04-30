import { vi } from "vitest";

import { BullMQJobQueue } from "../../adapters/bullmq/bullmq-job-queue.js";
import { BullMQJobWorker } from "../../adapters/bullmq/bullmq-job-worker.js";
import { delay } from "../helpers.js";

import type { JobId, Logger, UnixMillis } from "@pluralscape/types";
import type IORedis from "ioredis";

/**
 * Safety net: BullMQ's Worker creates a private blockingConnection whose
 * teardown can produce unhandled "Connection is closed" rejections from ioredis
 * when close() races with connection initialization. This handler catches only
 * that specific ioredis error and is scoped to the test process.
 */
export const ioredisRejectionHandler = (reason: unknown): void => {
  if (reason instanceof Error && reason.message === "Connection is closed.") {
    return;
  }
  // Throwing inside an unhandledRejection handler re-raises as an uncaught
  // exception, which Vitest will still catch as a test failure.
  throw reason;
};

export const mockLogger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/**
 * Valkey port resolution must mirror valkey-container.ts: CI sets
 * `TEST_VALKEY_PORT=6379`, local dev defaults to 10944. Hardcoding either
 * value breaks the other environment.
 */
export const VALKEY_TEST_PORT = Number(process.env["TEST_VALKEY_PORT"]) || 10_944;

let testId = 0;

export function nextQueueName(): string {
  testId++;
  return `test-${String(Date.now())}-${String(testId)}`;
}

export interface CreateQueueOptions {
  readonly clock?: () => UnixMillis;
  readonly logger?: Logger;
}

export function createQueue(redis: IORedis | null, options?: CreateQueueOptions): BullMQJobQueue {
  if (redis === null) throw new Error("Valkey not available");
  return new BullMQJobQueue(nextQueueName(), redis, {
    logger: options?.logger ?? mockLogger,
    clock: options?.clock,
  });
}

export interface ActiveTracking {
  readonly activeQueues: BullMQJobQueue[];
  readonly activeWorkers: BullMQJobWorker[];
}

export function createTracking(): ActiveTracking {
  return { activeQueues: [], activeWorkers: [] };
}

/**
 * Standard afterEach teardown for a tracking object — stops any running
 * workers, then obliterates and closes any queues. Errors during teardown are
 * logged but never thrown so test failures aren't masked.
 */
export async function teardownTracking(tracking: ActiveTracking): Promise<void> {
  for (const w of tracking.activeWorkers) {
    try {
      if (w.isRunning()) await w.stop();
    } catch (err) {
      mockLogger.warn("teardown", { error: String(err) });
    }
  }
  tracking.activeWorkers.length = 0;

  for (const q of tracking.activeQueues) {
    try {
      await q.obliterate();
    } catch (err) {
      mockLogger.warn("teardown", { error: String(err) });
    }
    try {
      await q.close();
    } catch (err) {
      mockLogger.warn("teardown", { error: String(err) });
    }
  }
  tracking.activeQueues.length = 0;
}

/**
 * Polling helper — waits until the predicate returns true, polling every
 * `intervalMs` until `timeoutMs` elapses.
 */
export async function waitFor(
  predicate: () => Promise<boolean>,
  { timeoutMs = 3000, intervalMs = 50 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(intervalMs);
  }
  throw new Error(`waitFor timed out after ${String(timeoutMs)}ms`);
}

/**
 * Rewrites the BullMQ-stored `data` hash field for a job so its (type,
 * payload) pair fails the discriminated `StoredJobDataSchema` invariant —
 * used to verify that read paths surface a typed `QueueCorruptionError`.
 */
export async function corruptJobData(
  redisConn: IORedis,
  queueName: string,
  jobId: JobId,
): Promise<void> {
  const rawKey = `bull:${queueName}:${jobId}`;
  const current = await redisConn.hget(rawKey, "data");
  if (current === null) throw new Error("expected BullMQ hash to contain `data`");
  const parsed = JSON.parse(current) as Record<string, unknown>;
  parsed["type"] = "webhook-deliver";
  parsed["payload"] = { notADeliveryId: true };
  await redisConn.hset(rawKey, "data", JSON.stringify(parsed));
}
