/**
 * Shared utility functions for the WebSocket server.
 *
 * Eliminates inline error formatting and SyncError construction
 * patterns duplicated across multiple modules.
 */
import type { SyncError } from "@pluralscape/sync";

/** Format an unknown error to a string message. */
export function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Construct a SyncError with common defaults. */
export function makeSyncError(
  code: SyncError["code"],
  message: string,
  correlationId: string | null,
  docId: string | null = null,
): SyncError {
  return { type: "SyncError", correlationId, code, message, docId };
}
