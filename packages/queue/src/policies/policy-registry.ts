import { DEFAULT_RETRY_POLICIES } from "./default-policies.js";

import type { JobQueue } from "../job-queue.js";
import type { JobType } from "@pluralscape/types";

/**
 * Applies the default retry policies for all job types to the given queue.
 *
 * Existing per-type overrides on the queue are replaced. Call this once
 * during queue initialisation before processing begins.
 */
export function applyDefaultPolicies(queue: JobQueue): void {
  for (const [type, policy] of Object.entries(DEFAULT_RETRY_POLICIES)) {
    queue.setRetryPolicy(type as JobType, policy);
  }
}
