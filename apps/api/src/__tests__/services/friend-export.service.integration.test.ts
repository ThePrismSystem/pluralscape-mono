import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgPrivacyTables,
  PG_DDL,
  pgExec,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import {
  createId,
  FRIEND_EXPORT_ENTITY_TYPES,
  ID_PREFIXES,
  now,
  brandId,
} from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  getFriendExportManifest,
  getFriendExportPage,
} from "../../services/friend-export.service.js";
import { asDb, assertApiError, makeAuth } from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AccountId,
  BucketId,
  FriendConnectionId,
  FriendExportEntityType,
  MemberId,
  SystemId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { buckets, bucketContentTags, friendBucketAssignments, friendConnections, members } = schema;

/** Number of entity types in the export registry. */
const EXPECTED_ENTITY_TYPE_COUNT = 21;

describe("friend-export.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let ownerAccountId: AccountId;
  let friendAccountId: AccountId;
  let systemId: SystemId;
  let friendAuth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgPrivacyTables(client);

    // All entity tables referenced by EXPORT_TABLE_REGISTRY must exist
    // for manifest queries (which JOIN across all 21 types in parallel).
    await pgExec(client, PG_DDL.members);
    await pgExec(client, PG_DDL.membersIndexes);
    await pgExec(client, PG_DDL.memberPhotos);
    await pgExec(client, PG_DDL.memberPhotosIndexes);
    await pgExec(client, PG_DDL.groups);
    await pgExec(client, PG_DDL.groupsIndexes);
    await pgExec(client, PG_DDL.channels);
    await pgExec(client, PG_DDL.channelsIndexes);
    await pgExec(client, PG_DDL.messages);
    await pgExec(client, PG_DDL.messagesIndexes);
    await pgExec(client, PG_DDL.notes);
    await pgExec(client, PG_DDL.notesIndexes);
    await pgExec(client, PG_DDL.polls);
    await pgExec(client, PG_DDL.pollsIndexes);
    await pgExec(client, PG_DDL.relationships);
    await pgExec(client, PG_DDL.relationshipsIndexes);
    await pgExec(client, PG_DDL.systemStructureEntityTypes);
    await pgExec(client, PG_DDL.systemStructureEntityTypesIndexes);
    await pgExec(client, PG_DDL.systemStructureEntities);
    await pgExec(client, PG_DDL.systemStructureEntitiesIndexes);
    await pgExec(client, PG_DDL.journalEntries);
    await pgExec(client, PG_DDL.journalEntriesIndexes);
    await pgExec(client, PG_DDL.wikiPages);
    await pgExec(client, PG_DDL.wikiPagesIndexes);
    await pgExec(client, PG_DDL.customFronts);
    await pgExec(client, PG_DDL.customFrontsIndexes);
    await pgExec(client, PG_DDL.frontingSessions);
    await pgExec(client, PG_DDL.frontingSessionsIndexes);
    await pgExec(client, PG_DDL.frontingComments);
    await pgExec(client, PG_DDL.frontingCommentsIndexes);
    await pgExec(client, PG_DDL.boardMessages);
    await pgExec(client, PG_DDL.boardMessagesIndexes);
    await pgExec(client, PG_DDL.acknowledgements);
    await pgExec(client, PG_DDL.acknowledgementsIndexes);
    await pgExec(client, PG_DDL.innerworldRegions);
    await pgExec(client, PG_DDL.innerworldRegionsIndexes);
    await pgExec(client, PG_DDL.innerworldEntities);
    await pgExec(client, PG_DDL.innerworldEntitiesIndexes);
    await pgExec(client, PG_DDL.fieldDefinitions);
    await pgExec(client, PG_DDL.fieldDefinitionsIndexes);
    await pgExec(client, PG_DDL.fieldValues);
    await pgExec(client, PG_DDL.fieldValuesIndexes);

    ownerAccountId = brandId<AccountId>(await pgInsertAccount(db));
    friendAccountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, ownerAccountId));
    friendAuth = makeAuth(friendAccountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(bucketContentTags);
    await db.delete(friendBucketAssignments);
    await db.delete(friendConnections);
    await db.delete(members);
    await db.delete(buckets);
  });

  // ── Helpers ─────────────────────────────────────────────────────────

  async function insertBilateralConnections(): Promise<{
    ownerConnectionId: FriendConnectionId;
    friendConnectionId: FriendConnectionId;
  }> {
    const ownerConnectionId = brandId<FriendConnectionId>(createId(ID_PREFIXES.friendConnection));
    const friendConnectionId = brandId<FriendConnectionId>(createId(ID_PREFIXES.friendConnection));
    const ts = now();

    await db.insert(friendConnections).values([
      {
        id: ownerConnectionId,
        accountId: ownerAccountId,
        friendAccountId,
        status: "accepted" as const,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: friendConnectionId,
        accountId: friendAccountId,
        friendAccountId: ownerAccountId,
        status: "accepted" as const,
        createdAt: ts,
        updatedAt: ts,
      },
    ]);

    return { ownerConnectionId, friendConnectionId };
  }

  async function insertBucket(): Promise<BucketId> {
    const id = createId(ID_PREFIXES.bucket);
    const ts = now();
    await db.insert(buckets).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return brandId<BucketId>(id);
  }

  async function insertBucketAssignment(
    connectionId: FriendConnectionId,
    bucketId: BucketId,
  ): Promise<void> {
    await db.insert(friendBucketAssignments).values({
      friendConnectionId: connectionId,
      bucketId,
      systemId,
    });
  }

  async function insertMember(updatedAt?: number): Promise<MemberId> {
    const id = createId(ID_PREFIXES.member);
    const ts = updatedAt ?? now();
    await db.insert(members).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return brandId<MemberId>(id);
  }

  async function insertBucketTag(
    entityType: FriendExportEntityType,
    entityId: string,
    bucketId: BucketId,
  ): Promise<void> {
    await db.insert(bucketContentTags).values({
      entityType,
      entityId,
      bucketId,
      systemId,
    });
  }

  // ── Manifest tests ────────────────────────────────────────────────

  it("returns zero counts when no bucket assignments exist", async () => {
    const { friendConnectionId } = await insertBilateralConnections();
    await insertMember();

    const manifest = await getFriendExportManifest(asDb(db), friendConnectionId, friendAuth);

    expect(manifest.systemId).toBe(systemId);
    for (const entry of manifest.entries) {
      expect(entry.count).toBe(0);
      expect(entry.lastUpdatedAt).toBeNull();
    }
  });

  it("returns correct count for bucket-visible member entities", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketId = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketId);

    const m1 = await insertMember();
    const m2 = await insertMember();
    await insertBucketTag("member", m1, bucketId);
    await insertBucketTag("member", m2, bucketId);

    const manifest = await getFriendExportManifest(asDb(db), friendConnectionId, friendAuth);

    const memberEntry = manifest.entries.find((e) => e.entityType === "member");
    expect(memberEntry?.count).toBe(2);
  });

  it("returns correct maxUpdatedAt timestamp across visible entities", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketId = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketId);

    const baseTs = now();
    const laterTs = baseTs + 5000;

    const m1 = await insertMember(baseTs);
    const m2 = await insertMember(laterTs);
    await insertBucketTag("member", m1, bucketId);
    await insertBucketTag("member", m2, bucketId);

    const manifest = await getFriendExportManifest(asDb(db), friendConnectionId, friendAuth);

    const memberEntry = manifest.entries.find((e) => e.entityType === "member");
    expect(memberEntry?.lastUpdatedAt).toBe(laterTs);
  });

  it("returns manifest entries for all entity types (21 entries)", async () => {
    const { friendConnectionId } = await insertBilateralConnections();

    const manifest = await getFriendExportManifest(asDb(db), friendConnectionId, friendAuth);

    expect(manifest.entries).toHaveLength(EXPECTED_ENTITY_TYPE_COUNT);

    const returnedTypes = manifest.entries.map((e) => e.entityType).sort();
    const expectedTypes = [...FRIEND_EXPORT_ENTITY_TYPES].sort();
    expect(returnedTypes).toEqual(expectedTypes);
  });

  it("only counts entities with matching bucket tags (not all entities)", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketA = await insertBucket();
    const bucketB = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketA);
    // bucketB is NOT assigned to the friend

    const visibleMember = await insertMember();
    const hiddenMember = await insertMember();
    await insertBucketTag("member", visibleMember, bucketA);
    await insertBucketTag("member", hiddenMember, bucketB);

    const manifest = await getFriendExportManifest(asDb(db), friendConnectionId, friendAuth);

    const memberEntry = manifest.entries.find((e) => e.entityType === "member");
    expect(memberEntry?.count).toBe(1);
  });

  // ── Paginated export tests ────────────────────────────────────────

  it("returns empty page when no bucket assignments", async () => {
    const { friendConnectionId } = await insertBilateralConnections();
    await insertMember();

    const page = await getFriendExportPage(asDb(db), friendConnectionId, friendAuth, "member", 10);

    expect(page.data).toHaveLength(0);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("returns bucket-visible entities only", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const assignedBucket = await insertBucket();
    const unassignedBucket = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, assignedBucket);

    const visibleMember = await insertMember();
    const hiddenMember = await insertMember();
    await insertBucketTag("member", visibleMember, assignedBucket);
    await insertBucketTag("member", hiddenMember, unassignedBucket);

    const page = await getFriendExportPage(asDb(db), friendConnectionId, friendAuth, "member", 10);

    expect(page.data).toHaveLength(1);
    expect(page.data[0]?.id).toBe(visibleMember);
    expect(page.data[0]?.entityType).toBe("member");
    expect(page.data[0]?.encryptedData).toEqual(expect.any(String));
    // Hidden member must not appear
    const ids = page.data.map((i) => i.id);
    expect(ids).not.toContain(hiddenMember);
  });

  it("cursor pagination returns non-overlapping pages across requests", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketId = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketId);

    // Create enough visible members to span multiple batches.
    // limit=2, batchSize=6 (OVERFETCH_MULTIPLIER=3), so >= 7 items needed for hasMore=true.
    const baseTs = now();
    const memberIds: MemberId[] = [];
    for (let i = 0; i < 8; i++) {
      const mid = await insertMember(baseTs + i * 1000);
      await insertBucketTag("member", mid, bucketId);
      memberIds.push(mid);
    }

    const page1 = await getFriendExportPage(asDb(db), friendConnectionId, friendAuth, "member", 2);
    expect(page1.data).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await getFriendExportPage(
      asDb(db),
      friendConnectionId,
      friendAuth,
      "member",
      2,
      page1.nextCursor ?? undefined,
    );
    expect(page2.data).toHaveLength(2);

    // Pages must not overlap
    const page1Ids = new Set(page1.data.map((i) => i.id));
    for (const item of page2.data) {
      expect(page1Ids.has(item.id)).toBe(false);
    }
  });

  it("over-fetches to fill pages when bucket filtering removes items", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const assignedBucket = await insertBucket();
    const unassignedBucket = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, assignedBucket);

    const baseTs = now();
    // Create alternating visible/invisible members so filtering removes some per batch
    for (let i = 0; i < 6; i++) {
      const mid = await insertMember(baseTs + i * 1000);
      const bucket = i % 2 === 0 ? assignedBucket : unassignedBucket;
      await insertBucketTag("member", mid, bucket);
    }
    // 3 visible, 3 invisible

    const page = await getFriendExportPage(asDb(db), friendConnectionId, friendAuth, "member", 3);

    // Should fill the page to the requested limit even though raw rows contain invisible ones
    expect(page.data).toHaveLength(3);
  });

  it("ordering is updatedAt ASC, id ASC", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketId = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketId);

    const baseTs = now();
    const m1 = await insertMember(baseTs);
    const m2 = await insertMember(baseTs + 2000);
    const m3 = await insertMember(baseTs + 1000);
    await insertBucketTag("member", m1, bucketId);
    await insertBucketTag("member", m2, bucketId);
    await insertBucketTag("member", m3, bucketId);

    const page = await getFriendExportPage(asDb(db), friendConnectionId, friendAuth, "member", 10);

    expect(page.data).toHaveLength(3);
    expect(page.data[0]?.id).toBe(m1);
    expect(page.data[1]?.id).toBe(m3);
    expect(page.data[2]?.id).toBe(m2);
  });

  it("hasMore is true when more data exists, false when exhausted", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketId = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketId);

    // With limit=2, batchSize = 2 * OVERFETCH_MULTIPLIER(3) = 6.
    // Need >= 7 visible items so first batch (6 rows) doesn't exhaust the DB.
    const baseTs = now();
    for (let i = 0; i < 8; i++) {
      const mid = await insertMember(baseTs + i * 1000);
      await insertBucketTag("member", mid, bucketId);
    }

    // First page: batch fetches 6 of 8 rows, DB not exhausted → hasMore=true
    const page1 = await getFriendExportPage(asDb(db), friendConnectionId, friendAuth, "member", 2);
    expect(page1.data).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).not.toBeNull();

    // Continue paginating until exhausted
    let lastPage = page1;
    let cursor = page1.nextCursor ?? undefined;
    while (lastPage.hasMore && cursor) {
      lastPage = await getFriendExportPage(
        asDb(db),
        friendConnectionId,
        friendAuth,
        "member",
        2,
        cursor,
      );
      cursor = lastPage.nextCursor ?? undefined;
    }

    // Final page must signal exhaustion
    expect(lastPage.hasMore).toBe(false);
    expect(lastPage.nextCursor).toBeNull();
  });

  // ── Error tests ───────────────────────────────────────────────────

  it("throws NOT_FOUND for non-existent connection", async () => {
    const fakeConnectionId = brandId<FriendConnectionId>(createId(ID_PREFIXES.friendConnection));

    await assertApiError(
      getFriendExportManifest(asDb(db), fakeConnectionId, friendAuth),
      "NOT_FOUND",
      404,
    );

    await assertApiError(
      getFriendExportPage(asDb(db), fakeConnectionId, friendAuth, "member", 10),
      "NOT_FOUND",
      404,
    );
  });

  it("throws NOT_FOUND for cross-account connection", async () => {
    const { ownerConnectionId } = await insertBilateralConnections();

    // friendAuth's accountId doesn't own ownerConnectionId — should 404
    await assertApiError(
      getFriendExportManifest(asDb(db), ownerConnectionId, friendAuth),
      "NOT_FOUND",
      404,
    );

    await assertApiError(
      getFriendExportPage(asDb(db), ownerConnectionId, friendAuth, "member", 10),
      "NOT_FOUND",
      404,
    );
  });
});
