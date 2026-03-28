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
  const payload = `${maxUpdatedAt === null ? "null" : String(maxUpdatedAt)}:${String(entityCount)}`;
  const hash = createHash("sha256").update(payload).digest("hex").slice(0, ETAG_HASH_LENGTH);
  return `W/"${hash}"`;
}

/** Entry shape accepted by computeManifestEtag — requires count and lastUpdatedAt. */
interface ManifestEtagEntry {
  readonly count: number;
  readonly lastUpdatedAt: UnixMillis | null;
}

/**
 * Compute an overall manifest ETag from per-entity-type manifest entries.
 *
 * Derives a global MAX(updatedAt) across all entries and a total count,
 * then delegates to computeDataEtag for the hash.
 */
export function computeManifestEtag(entries: readonly ManifestEtagEntry[]): string {
  const timestamps = entries.map((e) => e.lastUpdatedAt).filter((t): t is UnixMillis => t !== null);
  const globalMaxUpdatedAt: UnixMillis | null =
    timestamps.length > 0 ? (Math.max(...timestamps) as UnixMillis) : null;
  const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
  return computeDataEtag(globalMaxUpdatedAt, totalCount);
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
  return requestEtag.split(",").some((tag) => tag.trim() === currentEtag);
}
