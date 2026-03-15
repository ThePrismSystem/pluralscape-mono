import type { JobEventHooks } from "./event-hooks.js";
import type { JobLogger } from "./observability/job-logger.js";
import type { JobDefinition } from "@pluralscape/types";

/**
 * Dispatches a lifecycle hook, swallowing errors so they never propagate
 * back to callers. Optionally logs hook failures when a logger is provided.
 */
export async function fireHook(
  hooks: JobEventHooks,
  event: "onFail",
  job: JobDefinition,
  error: Error,
  logger?: JobLogger,
): Promise<void>;
export async function fireHook(
  hooks: JobEventHooks,
  event: "onComplete" | "onDeadLetter",
  job: JobDefinition,
  error?: undefined,
  logger?: JobLogger,
): Promise<void>;
export async function fireHook(
  hooks: JobEventHooks,
  event: keyof JobEventHooks,
  job: JobDefinition,
  error?: Error,
  logger?: JobLogger,
): Promise<void> {
  try {
    if (event === "onComplete") {
      await hooks.onComplete?.(job);
    } else if (event === "onFail" && error !== undefined) {
      await hooks.onFail?.(job, error);
    } else if (event === "onDeadLetter") {
      await hooks.onDeadLetter?.(job);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (logger !== undefined) {
      logger.error("hook.error", { event, jobId: job.id, error: message });
    } else {
      console.warn(`[queue] hook error: event=${event} jobId=${job.id} error=${message}`);
    }
  }
}
