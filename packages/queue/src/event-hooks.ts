import type { JobDefinition } from "@pluralscape/types";

/**
 * Lifecycle callbacks invoked by a JobQueue implementation on job state transitions.
 *
 * All hooks are optional. Implementations must call hooks after committing the state
 * change — never before. Hook errors must not propagate back to callers.
 */
export interface JobEventHooks {
  /** Called when a job transitions to `completed`. */
  onComplete?: (job: JobDefinition) => void | Promise<void>;
  /** Called when a job transitions to `failed` (retries remaining or exhausted). */
  onFail?: (job: JobDefinition, error: Error) => void | Promise<void>;
  /** Called when a job is moved to `dead-letter` (max retries exhausted). */
  onDeadLetter?: (job: JobDefinition) => void | Promise<void>;
}
