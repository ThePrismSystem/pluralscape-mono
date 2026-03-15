import type { JobEventHooks } from "../event-hooks.js";
import type { JobDefinition } from "@pluralscape/types";

/** Callback invoked when a job enters the dead-letter queue. */
export type AlertHandler = (job: JobDefinition) => void | Promise<void>;

/**
 * Creates event hooks that fire an alert when a job is dead-lettered.
 *
 * The actual alert transport (webhook, structured log, etc.) is
 * application-level — this factory just wires the hook.
 */
export function createAlertingHook(onAlert: AlertHandler): JobEventHooks {
  return {
    onDeadLetter: onAlert,
  };
}
