/**
 * Shared test helpers for switch-alert-dispatcher integration tests.
 * Used by basic-scenarios and multi-friend-cache suites.
 */
import { brandId } from "@pluralscape/types";

import type { JobQueue } from "@pluralscape/queue";
import type { JobDefinition, JobId, UnixMillis } from "@pluralscape/types";

/** Captured enqueue call shape. */
export interface EnqueuedJob {
  readonly type: string;
  readonly payload: unknown;
  readonly idempotencyKey: string;
}

/** Stub that throws — guards against the dispatcher touching surfaces this test doesn't stub. */
function notImplemented(method: string): () => never {
  return () => {
    throw new Error(`JobQueueMock.${method} was called but no stub was provided`);
  };
}

/** Typed mock JobQueue that captures enqueue calls. */
export function createMockQueue(options?: { failOnNth?: number }): {
  queue: JobQueue;
  enqueuedJobs: EnqueuedJob[];
} {
  const enqueuedJobs: EnqueuedJob[] = [];
  let callCount = 0;

  // Typed via JobQueue["enqueue"] so param inference flows from the interface.
  // The returned JobDefinition<T> is narrower than the interface's JobDefinition;
  // a single widening cast at the Promise.resolve boundary keeps the body strict
  // while satisfying the distributive-union return signature.
  const enqueue: JobQueue["enqueue"] = (params) => {
    callCount++;
    if (options?.failOnNth === callCount) {
      return Promise.reject(new Error("mock enqueue failure"));
    }
    enqueuedJobs.push({
      type: params.type,
      payload: params.payload,
      idempotencyKey: params.idempotencyKey,
    });
    const jobId = brandId<JobId>(`job_${crypto.randomUUID()}`);
    const nowTs = Date.now() as UnixMillis;
    const job = {
      id: jobId,
      systemId: null,
      type: params.type,
      payload: params.payload,
      status: "pending" as const,
      attempts: 0,
      maxAttempts: 3,
      nextRetryAt: null,
      error: null,
      result: null,
      createdAt: nowTs,
      startedAt: null,
      completedAt: null,
      idempotencyKey: params.idempotencyKey,
      lastHeartbeatAt: null,
      timeoutMs: 30_000,
      scheduledFor: null,
      priority: 0,
    };
    return Promise.resolve(job as JobDefinition);
  };

  const queue: JobQueue = {
    enqueue,
    checkIdempotency: notImplemented("checkIdempotency"),
    dequeue: notImplemented("dequeue"),
    acknowledge: notImplemented("acknowledge"),
    fail: notImplemented("fail"),
    retry: notImplemented("retry"),
    cancel: notImplemented("cancel"),
    getJob: notImplemented("getJob"),
    listJobs: notImplemented("listJobs"),
    listDeadLettered: notImplemented("listDeadLettered"),
    heartbeat: notImplemented("heartbeat"),
    findStalledJobs: notImplemented("findStalledJobs"),
    countJobs: notImplemented("countJobs"),
    getRetryPolicy: notImplemented("getRetryPolicy"),
    setRetryPolicy: notImplemented("setRetryPolicy"),
    setEventHooks: notImplemented("setEventHooks"),
  };
  return { queue, enqueuedJobs };
}
