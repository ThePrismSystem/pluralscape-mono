import type { JobQueue } from "../job-queue.js";
import type { JobEnqueueParams } from "../types.js";
import type { JobDefinition, JobType, SystemId } from "@pluralscape/types";

/** Builds a minimal valid JobEnqueueParams for use in tests. */
export function makeJobParams(
  overrides: Partial<JobEnqueueParams> & { type?: JobType } = {},
): JobEnqueueParams {
  return {
    type: "sync-push",
    systemId: null,
    payload: {},
    idempotencyKey: crypto.randomUUID(),
    priority: 0,
    ...overrides,
  };
}

/** Casts a string to SystemId for use in tests. */
export function testSystemId(id: string): SystemId {
  return id as SystemId;
}

/** Returns a Promise that resolves after `ms` milliseconds. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Dequeues a job from the queue and throws if null (test helper to avoid null guards). */
export async function dequeueOrFail(
  queue: JobQueue,
  types?: readonly JobType[],
): Promise<JobDefinition> {
  const job = await queue.dequeue(types);
  if (job === null) throw new Error("Expected a job to be dequeued");
  return job;
}
