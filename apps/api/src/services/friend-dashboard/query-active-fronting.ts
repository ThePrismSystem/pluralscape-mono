import { frontingSessions } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, eq, isNull } from "drizzle-orm";

import { filterVisibleEntities } from "../../lib/bucket-access.js";
import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";
import { MAX_ACTIVE_SESSIONS } from "../../service.constants.js";
import { cachedLoadBucketTags } from "./internal.js";

import type { BucketTagCache } from "./internal.js";
import type {
  BucketId,
  CustomFrontId,
  FriendDashboardResponse,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
  UnixMillis,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Fetch active fronting sessions visible to a friend via bucket intersection.
 *
 * Visibility is determined by the bucket tags of the session's subject entities
 * (member, custom front, structure entity), NOT the session itself. This aligns
 * with the switch-alert-dispatcher pattern.
 */
export async function queryVisibleActiveFronting(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
  cache: BucketTagCache,
): Promise<{
  sessions: FriendDashboardResponse["activeFronting"]["sessions"];
  isCofronting: boolean;
}> {
  if (friendBucketIds.length === 0) {
    return { sessions: [], isCofronting: false };
  }

  const rows = await tx
    .select({
      id: frontingSessions.id,
      memberId: frontingSessions.memberId,
      customFrontId: frontingSessions.customFrontId,
      structureEntityId: frontingSessions.structureEntityId,
      startTime: frontingSessions.startTime,
      encryptedData: frontingSessions.encryptedData,
    })
    .from(frontingSessions)
    .where(
      and(
        eq(frontingSessions.systemId, systemId),
        isNull(frontingSessions.endTime),
        eq(frontingSessions.archived, false),
      ),
    )
    .limit(MAX_ACTIVE_SESSIONS);

  if (rows.length === 0) {
    return { sessions: [], isCofronting: false };
  }

  // Collect subject entity IDs by type
  const memberIds = new Set<string>();
  const customFrontIds = new Set<string>();
  const structureEntityIds = new Set<string>();

  for (const r of rows) {
    if (r.memberId) memberIds.add(r.memberId);
    if (r.customFrontId) customFrontIds.add(r.customFrontId);
    if (r.structureEntityId) structureEntityIds.add(r.structureEntityId);
  }

  // Load bucket tags for each subject entity type in parallel (with caching)
  const [memberBucketMap, cfBucketMap, steBucketMap] = await Promise.all([
    memberIds.size > 0
      ? cachedLoadBucketTags(tx, systemId, "member", [...memberIds], cache)
      : new Map<string, BucketId[]>(),
    customFrontIds.size > 0
      ? cachedLoadBucketTags(tx, systemId, "custom-front", [...customFrontIds], cache)
      : new Map<string, BucketId[]>(),
    structureEntityIds.size > 0
      ? cachedLoadBucketTags(tx, systemId, "structure-entity", [...structureEntityIds], cache)
      : new Map<string, BucketId[]>(),
  ]);

  // Build a session-to-bucket map by merging subject entity bucket tags
  const sessionBucketMap = new Map<string, BucketId[]>();
  for (const r of rows) {
    const sessionBuckets: BucketId[] = [];
    if (r.memberId) {
      const mb = memberBucketMap.get(r.memberId);
      if (mb) sessionBuckets.push(...mb);
    }
    if (r.customFrontId) {
      const cb = cfBucketMap.get(r.customFrontId);
      if (cb) sessionBuckets.push(...cb);
    }
    if (r.structureEntityId) {
      const sb = steBucketMap.get(r.structureEntityId);
      if (sb) sessionBuckets.push(...sb);
    }
    if (sessionBuckets.length > 0) {
      sessionBucketMap.set(r.id, sessionBuckets);
    }
  }

  const visible = filterVisibleEntities(rows, friendBucketIds, sessionBucketMap, (r) => r.id);

  const sessions = visible.map((r) => ({
    id: brandId<FrontingSessionId>(r.id),
    memberId: r.memberId ? brandId<MemberId>(r.memberId) : null,
    customFrontId: r.customFrontId ? brandId<CustomFrontId>(r.customFrontId) : null,
    structureEntityId: r.structureEntityId
      ? brandId<SystemStructureEntityId>(r.structureEntityId)
      : null,
    startTime: r.startTime as UnixMillis,
    encryptedData: encryptedBlobToBase64(r.encryptedData),
  }));

  // Custom fronts represent abstract cognitive states, not members.
  // Only count sessions with a member or structure entity for co-fronting.
  const memberSessions = sessions.filter(
    (s) => s.memberId !== null || s.structureEntityId !== null,
  );

  return {
    sessions,
    isCofronting: memberSessions.length > 1,
  };
}
