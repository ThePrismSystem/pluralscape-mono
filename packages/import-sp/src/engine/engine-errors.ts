import { ApiSourceTokenRejectedError, ApiSourceTransientError } from "../sources/api-source.js";

import type { SpCollectionName } from "../sources/sp-collections.js";
import type { ImportEntityType, ImportError } from "@pluralscape/types";

export interface ClassifyContext {
  readonly entityType: ImportEntityType;
  readonly entityId: string | null;
}

/**
 * Thrown when the engine resumes mid-collection with a checkpointed
 * `currentCollectionLastSourceId` that the source no longer yields — e.g.
 * the document was deleted between runs. Classified as fatal + recoverable:
 * the user needs to restart the import from scratch (or from an earlier
 * checkpoint) rather than silently skipping the rest of the collection.
 */
export class ResumeCutoffNotFoundError extends Error {
  public readonly collection: SpCollectionName;
  public readonly cutoffId: string;
  public constructor(collection: SpCollectionName, cutoffId: string) {
    super(
      `resume cutoff not found in ${collection} — source may have been modified since last run (looking for ${cutoffId})`,
    );
    this.name = "ResumeCutoffNotFoundError";
    this.collection = collection;
    this.cutoffId = cutoffId;
  }
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
 *
 * Fatal errors set `entityType: "unknown"` because the failure is transport-
 * or parse-level, not document-level — there is no specific entity to
 * attribute it to. Non-fatal errors carry `ctx.entityType`/`ctx.entityId` so
 * the persister can record per-document failures.
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
  if (thrown instanceof ResumeCutoffNotFoundError) {
    return {
      entityType: "unknown",
      entityId: thrown.cutoffId,
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
