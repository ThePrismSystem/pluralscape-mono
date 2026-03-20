import { extractErrorMessage } from "@pluralscape/types";

import type { JobEventHooks } from "./event-hooks.js";
import type { JobDefinition, Logger } from "@pluralscape/types";

/**
 * Dispatches a lifecycle hook, swallowing errors so they never propagate
 * back to callers. Optionally logs hook failures when a logger is provided.
 */
export async function fireHook(
  hooks: JobEventHooks,
  event: "onFail",
  job: JobDefinition,
  error: Error,
  logger: Pick<Logger, "error">,
): Promise<void>;
export async function fireHook(
  hooks: JobEventHooks,
  event: "onComplete" | "onDeadLetter",
  job: JobDefinition,
  error: undefined,
  logger: Pick<Logger, "error">,
): Promise<void>;
export async function fireHook(
  hooks: JobEventHooks,
  event: keyof JobEventHooks,
  job: JobDefinition,
  error: Error | undefined,
  logger: Pick<Logger, "error">,
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
    logger.error("hook.error", { event, jobId: job.id, error: extractErrorMessage(err) });
  }
}
