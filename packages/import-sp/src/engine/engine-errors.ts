import { ApiSourceTokenRejectedError, ApiSourceTransientError } from "../sources/api-source.js";

import type { ImportEntityType, ImportError } from "@pluralscape/types";

export interface ClassifyContext {
  readonly entityType: ImportEntityType;
  readonly entityId: string | null;
}

/**
 * Convert an arbitrary thrown value into the structured `ImportError` shape
 * the persister stores on `import_jobs.error_log`.
 *
 * - Source-level transport errors (`ApiSourceTokenRejectedError`,
 *   `ApiSourceTransientError`) are fatal but recoverable: the user can retry
 *   from the last checkpoint after fixing credentials or backoff conditions.
 * - `SyntaxError` indicates an unparseable payload: fatal and non-recoverable
 *   (the user must restart the import or fix the source data).
 * - Anything else is treated as a per-document failure: non-fatal so the
 *   engine can record it and keep iterating.
 */
export function classifyError(thrown: unknown, ctx: ClassifyContext): ImportError {
  if (thrown instanceof ApiSourceTokenRejectedError) {
    return {
      entityType: "unknown",
      entityId: null,
      message: thrown.message,
      fatal: true,
      recoverable: true,
    };
  }
  if (thrown instanceof ApiSourceTransientError) {
    return {
      entityType: "unknown",
      entityId: null,
      message: thrown.message,
      fatal: true,
      recoverable: true,
    };
  }
  if (thrown instanceof SyntaxError) {
    return {
      entityType: "unknown",
      entityId: null,
      message: `JSON parse error: ${thrown.message}`,
      fatal: true,
      recoverable: false,
    };
  }
  const message = thrown instanceof Error ? thrown.message : String(thrown);
  return {
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    message,
    fatal: false,
    recoverable: false,
  };
}

export function isFatalError(error: ImportError): boolean {
  return error.fatal;
}
