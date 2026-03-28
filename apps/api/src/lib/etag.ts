import { createHash } from "node:crypto";

import type { UnixMillis } from "@pluralscape/types";

/** Number of hex characters to use from the SHA-256 digest for the ETag value. */
const ETAG_HASH_LENGTH = 16;

/**
 * Compute a weak ETag from data freshness metadata.
 *
 * The ETag encodes MAX(updatedAt) and entity count — it changes when
 * entities are added, removed, or modified.
 */
export function computeDataEtag(maxUpdatedAt: UnixMillis | null, entityCount: number): string {
  const payload = `${String(maxUpdatedAt ?? 0)}:${String(entityCount)}`;
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, ETAG_HASH_LENGTH);
  return `W/"${hash}"`;
}

/**
 * Check whether an If-None-Match request header matches the current ETag.
 *
 * Returns true when the client's cached version is still fresh (304 should be returned).
 */
export function checkConditionalRequest(
  requestEtag: string | undefined,
  currentEtag: string,
): boolean {
  if (!requestEtag) return false;
  if (requestEtag === "*") return true;
  return requestEtag === currentEtag;
}
