/**
 * Shared utility functions for the WebSocket server.
 *
 * Eliminates inline error formatting and SyncError construction
 * patterns duplicated across multiple modules.
 */
import type { SyncError } from "@pluralscape/sync";
import type { SyncDocumentId } from "@pluralscape/types";

/** Format an unknown error to a loggable string (includes stack trace when available). */
export function formatError(err: unknown): string {
  return err instanceof Error ? (err.stack ?? err.message) : String(err);
}

/** Type-safe branded Set membership check (single-location cast). */
export function brandedSetHas<T extends string>(set: ReadonlySet<T>, value: string): boolean {
  return set.has(value as T);
}

/** Construct a SyncError with common defaults. */
export function makeSyncError(
  code: SyncError["code"],
  message: string,
  correlationId: string | null,
  docId: SyncDocumentId | null = null,
): SyncError {
  return { type: "SyncError", correlationId, code, message, docId };
}
