import type { Archived, PrivacyBucket, UnixMillis } from "@pluralscape/types";

// ── Encrypted payload types ───────────────────────────────────────────

/** The subset of PrivacyBucket fields stored encrypted on the server. */
export interface BucketEncryptedFields {
  readonly name: string;
  readonly description: string | null;
}

// ── Wire types ────────────────────────────────────────────────────────

/** Wire shape returned by `privacyBucket.get` — derived from the `PrivacyBucket` domain type. */
export type PrivacyBucketRaw = Omit<PrivacyBucket, "archived"> & {
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** Shape returned by `privacyBucket.list`. */
export interface PrivacyBucketPage {
  readonly data: readonly PrivacyBucketRaw[];
  readonly nextCursor: string | null;
}

// ── Transforms ────────────────────────────────────────────────────────

/**
 * Narrow a single privacy bucket API result into a `PrivacyBucket` or `Archived<PrivacyBucket>`.
 */
export function narrowPrivacyBucket(
  raw: PrivacyBucketRaw,
): PrivacyBucket | Archived<PrivacyBucket> {
  const base = {
    id: raw.id,
    systemId: raw.systemId,
    name: raw.name,
    description: raw.description,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived privacyBucket missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

/**
 * Narrow a paginated privacy bucket list result.
 */
export function narrowPrivacyBucketPage(raw: PrivacyBucketPage): {
  data: (PrivacyBucket | Archived<PrivacyBucket>)[];
  nextCursor: string | null;
} {
  return {
    data: raw.data.map(narrowPrivacyBucket),
    nextCursor: raw.nextCursor,
  };
}
