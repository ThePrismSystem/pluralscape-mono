import { parseDocumentId } from "./document-types.js";

import type { SyncManifestEntry } from "./adapters/network-adapter.js";
import type {
  FriendProfile,
  OwnerLiteProfile,
  ReplicationProfile,
  SubscriptionSet,
} from "./replication-profiles.js";

/**
 * Applies a replication profile to a manifest, producing a subscription set
 * that determines which documents are actively synced, available on-demand, or evicted.
 */
export function filterManifest(
  manifest: { readonly documents: readonly SyncManifestEntry[] },
  profile: ReplicationProfile,
  localDocIds: readonly string[],
  nowMs?: number,
): SubscriptionSet {
  switch (profile.profileType) {
    case "owner-full":
      return filterOwnerFull(manifest.documents, localDocIds);
    case "owner-lite":
      return filterOwnerLite(manifest.documents, profile, localDocIds, nowMs);
    case "friend":
      return filterFriend(manifest.documents, profile, localDocIds);
    default: {
      const _exhaustive: never = profile;
      throw new Error(`Unknown profile type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function filterOwnerFull(
  documents: readonly SyncManifestEntry[],
  localDocIds: readonly string[],
): SubscriptionSet {
  const active: SyncManifestEntry[] = [];
  const available: SyncManifestEntry[] = [];
  const manifestIds = new Set(documents.map((e) => e.docId));

  for (const entry of documents) {
    if (entry.archived) {
      available.push(entry);
    } else {
      active.push(entry);
    }
  }

  const evict = localDocIds.filter((id) => !manifestIds.has(id));
  return { active, available, evict };
}

function filterOwnerLite(
  documents: readonly SyncManifestEntry[],
  profile: OwnerLiteProfile,
  localDocIds: readonly string[],
  nowMs?: number,
): SubscriptionSet {
  const now = nowMs ?? Date.now();
  const manifestIds = new Set(documents.map((e) => e.docId));
  const latest = latestTimePeriodByType(documents);

  const active: SyncManifestEntry[] = [];
  const available: SyncManifestEntry[] = [];

  for (const entry of documents) {
    if (entry.archived) {
      available.push(entry);
      continue;
    }

    let parsed;
    try {
      parsed = parseDocumentId(entry.docId);
    } catch {
      continue;
    }

    switch (parsed.documentType) {
      case "system-core":
      case "privacy-config":
      case "bucket":
        active.push(entry);
        break;

      case "fronting": {
        const key = `fronting-${parsed.entityId}`;
        const latestPeriod = latest.get(key);
        if (latestPeriod === undefined || parsed.timePeriod === latestPeriod) {
          active.push(entry);
        } else {
          available.push(entry);
        }
        break;
      }

      case "chat": {
        const key = `chat-${parsed.entityId}`;
        const latestPeriod = latest.get(key);
        const isCurrentPeriod =
          latestPeriod === undefined
            ? parsed.timePeriod === null
            : parsed.timePeriod === latestPeriod;

        if (isCurrentPeriod && isActiveChannel(entry, profile.activeChannelWindowDays, now)) {
          active.push(entry);
        } else {
          available.push(entry);
        }
        break;
      }

      case "journal":
        available.push(entry);
        break;

      default: {
        const _exhaustive: never = parsed;
        throw new Error(`Unhandled document type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  const evict = localDocIds.filter((id) => !manifestIds.has(id));
  return { active, available, evict };
}

function filterFriend(
  documents: readonly SyncManifestEntry[],
  profile: FriendProfile,
  localDocIds: readonly string[],
): SubscriptionSet {
  const grantedBuckets = new Set(profile.grantedBucketIds);

  const active = documents.filter(
    (e) => e.docType === "bucket" && e.bucketId !== null && grantedBuckets.has(e.bucketId),
  );

  const activeIds = new Set(active.map((e) => e.docId));
  const evict = localDocIds.filter((id) => !activeIds.has(id));

  return { active, available: [], evict };
}

/** Finds the lexicographically latest timePeriod for each (docType, entityId) pair. */
function latestTimePeriodByType(documents: readonly SyncManifestEntry[]): Map<string, string> {
  const latest = new Map<string, string>();

  for (const entry of documents) {
    if (entry.timePeriod === null) continue;

    let parsed;
    try {
      parsed = parseDocumentId(entry.docId);
    } catch {
      continue;
    }

    const key = `${parsed.documentType}-${parsed.entityId}`;
    const current = latest.get(key);

    // Lexicographic comparison is correct: YYYY-QN, YYYY-MM, and YYYY formats
    // are each scoped to a single documentType-entityId key, so cross-format
    // comparison never occurs. Within each format, lexicographic order matches
    // chronological order (e.g. "2026-Q1" < "2026-Q2", "2026-03" < "2026-12").
    if (current === undefined || entry.timePeriod > current) {
      latest.set(key, entry.timePeriod);
    }
  }

  return latest;
}

const MS_PER_DAY = 86_400_000;

function isActiveChannel(entry: SyncManifestEntry, windowDays: number, nowMs: number): boolean {
  const windowMs = windowDays * MS_PER_DAY;
  return nowMs - entry.updatedAt <= windowMs;
}
