import type { ManifestRequest, ManifestResponse, SyncError } from "@pluralscape/sync";

/** Handle a ManifestRequest. Phase 1: returns empty manifest stub. */
export function handleManifestRequest(message: ManifestRequest): ManifestResponse | SyncError {
  // Full manifest implementation is in the CRDT sync epic (sync-qxxo).
  // For now, return an empty manifest so the protocol flow can proceed.
  return {
    type: "ManifestResponse",
    correlationId: message.correlationId,
    manifest: { documents: [], systemId: message.systemId },
  };
}
