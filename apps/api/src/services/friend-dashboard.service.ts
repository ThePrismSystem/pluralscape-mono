import {
  bucketContentTags,
  customFronts,
  frontingSessions,
  keyGrants,
  members,
  systemStructureEntities,
} from "@pluralscape/db/pg";
import { and, count, eq, inArray, isNull } from "drizzle-orm";

import { filterVisibleEntities } from "../lib/bucket-access.js";
import { encryptedBlobToBase64 } from "../lib/encrypted-blob.js";
import { assertFriendAccess } from "../lib/friend-access.js";
import { withCrossAccountRead } from "../lib/rls-context.js";
import { MAX_ACTIVE_SESSIONS } from "../service.constants.js";

import type { AuthContext } from "../lib/auth-context.js";
import type {
  BucketContentEntityType,
  BucketId,
  EncryptedBlob,
  FriendConnectionId,
  FriendDashboardResponse,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Internal result types (DB row → dashboard shape) ────────────

interface DashboardEntityRow {
  readonly id: string;
  readonly encryptedData: EncryptedBlob;
}

// ── Query helpers ───────────────────────────────────────────────

/** Fetch active fronting sessions visible to a friend via bucket intersection. */
export async function queryVisibleActiveFronting(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
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

  // Load bucket tags for fronting sessions
  const sessionIds = rows.map((r) => r.id);
  const entityBucketMap = await loadBucketTags(tx, systemId, "fronting-session", sessionIds);

  const visible = filterVisibleEntities(rows, friendBucketIds, entityBucketMap, (r) => r.id);

  const sessions = visible.map((r) => ({
    id: r.id as FriendDashboardResponse["activeFronting"]["sessions"][number]["id"],
    memberId:
      r.memberId as FriendDashboardResponse["activeFronting"]["sessions"][number]["memberId"],
    customFrontId:
      r.customFrontId as FriendDashboardResponse["activeFronting"]["sessions"][number]["customFrontId"],
    structureEntityId:
      r.structureEntityId as FriendDashboardResponse["activeFronting"]["sessions"][number]["structureEntityId"],
    startTime:
      r.startTime as FriendDashboardResponse["activeFronting"]["sessions"][number]["startTime"],
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

/** Fetch non-archived members visible to a friend via bucket intersection. */
export async function queryVisibleMembers(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
): Promise<FriendDashboardResponse["visibleMembers"]> {
  if (friendBucketIds.length === 0) {
    return [];
  }

  const rows: DashboardEntityRow[] = await tx
    .select({
      id: members.id,
      encryptedData: members.encryptedData,
    })
    .from(members)
    .where(and(eq(members.systemId, systemId), eq(members.archived, false)));

  const memberIds = rows.map((r) => r.id);
  const entityBucketMap = await loadBucketTags(tx, systemId, "member", memberIds);

  const visible = filterVisibleEntities(rows, friendBucketIds, entityBucketMap, (r) => r.id);

  return visible.map((r) => ({
    id: r.id as FriendDashboardResponse["visibleMembers"][number]["id"],
    encryptedData: encryptedBlobToBase64(r.encryptedData),
  }));
}

/** Fetch non-archived custom fronts visible to a friend via bucket intersection. */
export async function queryVisibleCustomFronts(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
): Promise<FriendDashboardResponse["visibleCustomFronts"]> {
  if (friendBucketIds.length === 0) {
    return [];
  }

  const rows: DashboardEntityRow[] = await tx
    .select({
      id: customFronts.id,
      encryptedData: customFronts.encryptedData,
    })
    .from(customFronts)
    .where(and(eq(customFronts.systemId, systemId), eq(customFronts.archived, false)));

  const cfIds = rows.map((r) => r.id);
  const entityBucketMap = await loadBucketTags(tx, systemId, "custom-front", cfIds);

  const visible = filterVisibleEntities(rows, friendBucketIds, entityBucketMap, (r) => r.id);

  return visible.map((r) => ({
    id: r.id as FriendDashboardResponse["visibleCustomFronts"][number]["id"],
    encryptedData: encryptedBlobToBase64(r.encryptedData),
  }));
}

/** Fetch non-archived structure entities visible to a friend via bucket intersection. */
export async function queryVisibleStructureEntities(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendBucketIds: readonly BucketId[],
): Promise<FriendDashboardResponse["visibleStructureEntities"]> {
  if (friendBucketIds.length === 0) {
    return [];
  }

  const rows: DashboardEntityRow[] = await tx
    .select({
      id: systemStructureEntities.id,
      encryptedData: systemStructureEntities.encryptedData,
    })
    .from(systemStructureEntities)
    .where(
      and(
        eq(systemStructureEntities.systemId, systemId),
        eq(systemStructureEntities.archived, false),
      ),
    );

  const entityIds = rows.map((r) => r.id);
  const entityBucketMap = await loadBucketTags(tx, systemId, "structure-entity", entityIds);

  const visible = filterVisibleEntities(rows, friendBucketIds, entityBucketMap, (r) => r.id);

  return visible.map((r) => ({
    id: r.id as FriendDashboardResponse["visibleStructureEntities"][number]["id"],
    encryptedData: encryptedBlobToBase64(r.encryptedData),
  }));
}

/** Count total non-archived members (NOT bucket-filtered). */
export async function queryMemberCount(
  tx: PostgresJsDatabase,
  systemId: SystemId,
): Promise<number> {
  const [result] = await tx
    .select({ value: count() })
    .from(members)
    .where(and(eq(members.systemId, systemId), eq(members.archived, false)));

  return result?.value ?? 0;
}

/** Fetch active (non-revoked) key grants for this friend. */
export async function queryActiveKeyGrants(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  friendAccountId: string,
): Promise<FriendDashboardResponse["keyGrants"]> {
  const rows = await tx
    .select({
      id: keyGrants.id,
      bucketId: keyGrants.bucketId,
      encryptedKey: keyGrants.encryptedKey,
      keyVersion: keyGrants.keyVersion,
    })
    .from(keyGrants)
    .where(
      and(
        eq(keyGrants.systemId, systemId),
        eq(keyGrants.friendAccountId, friendAccountId),
        isNull(keyGrants.revokedAt),
      ),
    );

  return rows.map((r) => ({
    id: r.id as FriendDashboardResponse["keyGrants"][number]["id"],
    bucketId: r.bucketId as FriendDashboardResponse["keyGrants"][number]["bucketId"],
    encryptedKey: Buffer.from(r.encryptedKey).toString("base64"),
    keyVersion: r.keyVersion,
  }));
}

// ── Orchestrator ────────────────────────────────────────────────

/**
 * Get the friend dashboard for a connection.
 *
 * Runs assertFriendAccess + all queries in a single withCrossAccountRead
 * transaction to prevent TOCTOU races.
 */
export async function getFriendDashboard(
  db: PostgresJsDatabase,
  connectionId: FriendConnectionId,
  auth: AuthContext,
): Promise<FriendDashboardResponse> {
  return withCrossAccountRead(db, async (tx) => {
    const access = await assertFriendAccess(tx, connectionId, auth);

    const [
      activeFronting,
      visibleMembers,
      visibleCustomFronts,
      visibleStructureEntities,
      memberCount,
      activeKeyGrants,
    ] = await Promise.all([
      queryVisibleActiveFronting(tx, access.targetSystemId, access.assignedBucketIds),
      queryVisibleMembers(tx, access.targetSystemId, access.assignedBucketIds),
      queryVisibleCustomFronts(tx, access.targetSystemId, access.assignedBucketIds),
      queryVisibleStructureEntities(tx, access.targetSystemId, access.assignedBucketIds),
      queryMemberCount(tx, access.targetSystemId),
      queryActiveKeyGrants(tx, access.targetSystemId, access.targetAccountId),
    ]);

    return {
      systemId: access.targetSystemId,
      memberCount,
      activeFronting,
      visibleMembers,
      visibleCustomFronts,
      visibleStructureEntities,
      keyGrants: activeKeyGrants,
    };
  });
}

// ── Internal helpers ────────────────────────────────────────────

/**
 * Load bucket content tags for a set of entities and build a map
 * from entity ID to bucket IDs.
 */
async function loadBucketTags(
  tx: PostgresJsDatabase,
  systemId: SystemId,
  entityType: BucketContentEntityType,
  entityIds: readonly string[],
): Promise<ReadonlyMap<string, readonly BucketId[]>> {
  if (entityIds.length === 0) {
    return new Map();
  }

  const tags = await tx
    .select({
      entityId: bucketContentTags.entityId,
      bucketId: bucketContentTags.bucketId,
    })
    .from(bucketContentTags)
    .where(
      and(
        eq(bucketContentTags.systemId, systemId),
        eq(bucketContentTags.entityType, entityType),
        inArray(bucketContentTags.entityId, entityIds as string[]),
      ),
    );

  const map = new Map<string, BucketId[]>();
  for (const tag of tags) {
    const existing = map.get(tag.entityId);
    if (existing) {
      existing.push(tag.bucketId as BucketId);
    } else {
      map.set(tag.entityId, [tag.bucketId as BucketId]);
    }
  }

  return map;
}
