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
import { createId, ID_PREFIXES, now, brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getFriendDashboard } from "../../services/friend-dashboard/get-dashboard.js";
import { asDb, assertApiError, makeAuth } from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AccountId,
  BucketId,
  CustomFrontId,
  FriendConnectionId,
  FrontingSessionId,
  KeyGrantId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const {
  buckets,
  bucketContentTags,
  friendBucketAssignments,
  friendConnections,
  frontingSessions,
  keyGrants,
  members,
  customFronts,
  systemStructureEntities,
  systemStructureEntityTypes,
} = schema;

describe("friend-dashboard.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let ownerAccountId: AccountId;
  let friendAccountId: AccountId;
  let systemId: SystemId;
  let friendAuth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    // Privacy tables: accounts, systems, buckets, bucketContentTags,
    // keyGrants, friendConnections, friendCodes, friendBucketAssignments
    await createPgPrivacyTables(client);

    // Fronting tables that aren't already created by privacy tables:
    // members, systemStructureEntityTypes, systemStructureEntities,
    // customFronts, frontingSessions, frontingComments
    await pgExec(client, PG_DDL.members);
    await pgExec(client, PG_DDL.membersIndexes);
    await pgExec(client, PG_DDL.systemStructureEntityTypes);
    await pgExec(client, PG_DDL.systemStructureEntityTypesIndexes);
    await pgExec(client, PG_DDL.systemStructureEntities);
    await pgExec(client, PG_DDL.systemStructureEntitiesIndexes);
    await pgExec(client, PG_DDL.customFronts);
    await pgExec(client, PG_DDL.customFrontsIndexes);
    await pgExec(client, PG_DDL.frontingSessions);
    await pgExec(client, PG_DDL.frontingSessionsIndexes);

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
    await db.delete(frontingSessions);
    await db.delete(keyGrants);
    await db.delete(friendBucketAssignments);
    await db.delete(friendConnections);
    await db.delete(members);
    await db.delete(customFronts);
    await db.delete(systemStructureEntities);
    await db.delete(systemStructureEntityTypes);
    await db.delete(buckets);
  });

  // ── Helpers ─────────────────────────────────────────────────────────

  /** Create bilateral friend connections (owner -> friend and friend -> owner). */
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

  async function insertKeyGrant(bucketId: BucketId): Promise<KeyGrantId> {
    const id = createId(ID_PREFIXES.keyGrant);
    await db.insert(keyGrants).values({
      id,
      bucketId,
      systemId,
      friendAccountId,
      encryptedKey: Buffer.from("test-encrypted-key"),
      keyVersion: 1,
      createdAt: now(),
    });
    return brandId<KeyGrantId>(id);
  }

  async function insertMember(): Promise<MemberId> {
    const id = createId(ID_PREFIXES.member);
    const ts = now();
    await db.insert(members).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return brandId<MemberId>(id);
  }

  async function insertCustomFront(): Promise<CustomFrontId> {
    const id = createId(ID_PREFIXES.customFront);
    const ts = now();
    await db.insert(customFronts).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return brandId<CustomFrontId>(id);
  }

  async function insertStructureEntityType(): Promise<string> {
    const id = createId(ID_PREFIXES.structureEntityType);
    const ts = now();
    await db.insert(systemStructureEntityTypes).values({
      id,
      systemId,
      sortOrder: 0,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return id;
  }

  async function insertStructureEntity(
    entityTypeId: string,
    sortOrder: number,
  ): Promise<SystemStructureEntityId> {
    const id = createId(ID_PREFIXES.structureEntity);
    const ts = now();
    await db.insert(systemStructureEntities).values({
      id,
      systemId,
      entityTypeId,
      sortOrder,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return brandId<SystemStructureEntityId>(id);
  }

  async function insertBucketTag(
    entityType: "member" | "custom-front" | "structure-entity",
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

  async function insertFrontingSession(
    memberId: MemberId | null,
    customFrontId: CustomFrontId | null = null,
  ): Promise<FrontingSessionId> {
    const id = brandId<FrontingSessionId>(createId(ID_PREFIXES.frontingSession));
    const ts = now();
    await db.insert(frontingSessions).values({
      id,
      systemId,
      startTime: ts,
      endTime: null,
      memberId,
      customFrontId,
      structureEntityId: null,
      encryptedData: testBlob(),
      createdAt: ts,
      updatedAt: ts,
    });
    return id;
  }

  // ── Tests ───────────────────────────────────────────────────────────

  it("returns dashboard with visible members and key grants", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketId = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketId);

    const memberId = await insertMember();
    await insertBucketTag("member", memberId, bucketId);
    const keyGrantId = await insertKeyGrant(bucketId);

    const result = await getFriendDashboard(asDb(db), friendConnectionId, friendAuth);

    expect(result.systemId).toBe(systemId);
    // memberCount is now bucket-filtered (H2 fix) — should match visible members
    expect(result.memberCount).toBe(1);
    expect(result.visibleMembers).toHaveLength(1);
    expect(result.visibleMembers[0]?.id).toBe(memberId);
    expect(result.visibleMembers[0]?.encryptedData).toEqual(expect.any(String));
    expect(result.keyGrants).toHaveLength(1);
    expect(result.keyGrants[0]?.id).toBe(keyGrantId);
    expect(result.keyGrants[0]?.bucketId).toBe(bucketId);
    expect(result.keyGrants[0]?.keyVersion).toBe(1);
  });

  it("returns empty filtered arrays when no bucket assignments", async () => {
    const { friendConnectionId } = await insertBilateralConnections();

    // Insert a member but with no bucket assignments — both memberCount and
    // visibleMembers should be 0 (H2 fix: memberCount is bucket-filtered)
    await insertMember();

    const result = await getFriendDashboard(asDb(db), friendConnectionId, friendAuth);

    expect(result.systemId).toBe(systemId);
    expect(result.memberCount).toBe(0);
    expect(result.visibleMembers).toHaveLength(0);
    expect(result.visibleCustomFronts).toHaveLength(0);
    expect(result.visibleStructureEntities).toHaveLength(0);
    expect(result.activeFronting.sessions).toHaveLength(0);
    expect(result.keyGrants).toHaveLength(0);
  });

  it("returns fronting session visible via member bucket tags", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketId = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketId);

    const memberId = await insertMember();
    await insertBucketTag("member", memberId, bucketId);
    await insertFrontingSession(memberId);

    const result = await getFriendDashboard(asDb(db), friendConnectionId, friendAuth);

    expect(result.activeFronting.sessions).toHaveLength(1);
    expect(result.activeFronting.sessions[0]?.memberId).toBe(memberId);
    expect(result.activeFronting.isCofronting).toBe(false);
  });

  it("detects co-fronting with multiple member sessions", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketId = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketId);

    const memberId1 = await insertMember();
    const memberId2 = await insertMember();
    await insertBucketTag("member", memberId1, bucketId);
    await insertBucketTag("member", memberId2, bucketId);
    await insertFrontingSession(memberId1);
    await insertFrontingSession(memberId2);

    const result = await getFriendDashboard(asDb(db), friendConnectionId, friendAuth);

    expect(result.activeFronting.isCofronting).toBe(true);
    expect(result.activeFronting.sessions).toHaveLength(2);
  });

  it("returns custom front visible via bucket tags", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketId = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketId);

    const customFrontId = await insertCustomFront();
    await insertBucketTag("custom-front", customFrontId, bucketId);

    const result = await getFriendDashboard(asDb(db), friendConnectionId, friendAuth);

    expect(result.visibleCustomFronts).toHaveLength(1);
    expect(result.visibleCustomFronts[0]?.id).toBe(customFrontId);
    expect(result.visibleCustomFronts[0]?.encryptedData).toEqual(expect.any(String));
  });

  it("memberCount only counts bucket-visible members (H2 privacy fix)", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketId = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketId);

    // Create 3 members but only tag 1 with the friend's bucket
    const visibleMemberId = await insertMember();
    await insertMember(); // invisible member 1
    await insertMember(); // invisible member 2
    await insertBucketTag("member", visibleMemberId, bucketId);

    const result = await getFriendDashboard(asDb(db), friendConnectionId, friendAuth);

    // Friend should see memberCount=1, NOT 3 (total system size)
    expect(result.memberCount).toBe(1);
    expect(result.visibleMembers).toHaveLength(1);
    expect(result.visibleMembers[0]?.id).toBe(visibleMemberId);
  });

  // Regression for api-5y16: prior to the fix, queryVisibleEntities hard-capped
  // at MAX_PAGE_LIMIT=100 so systems with more than 100 visible members silently
  // truncated the friend's dashboard. Cap is now MAX_MEMBERS_PER_SYSTEM (5 000),
  // so a realistic "many members visible" scenario returns every visible row.
  it("returns more than the legacy MAX_PAGE_LIMIT of 100 visible members", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketId = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketId);

    const TOTAL_MEMBERS = 120;
    const memberIds: MemberId[] = [];
    for (let i = 0; i < TOTAL_MEMBERS; i++) {
      const id = await insertMember();
      memberIds.push(id);
      await insertBucketTag("member", id, bucketId);
    }

    const result = await getFriendDashboard(asDb(db), friendConnectionId, friendAuth);

    expect(result.memberCount).toBe(TOTAL_MEMBERS);
    expect(result.visibleMembers).toHaveLength(TOTAL_MEMBERS);
    const returnedIds = new Set(result.visibleMembers.map((m) => m.id));
    for (const id of memberIds) {
      expect(returnedIds.has(id)).toBe(true);
    }
  }, 30_000);

  // Regression for api-5y16: queryVisibleCustomFronts was capped at
  // MAX_PAGE_LIMIT (100). Cap is now MAX_CUSTOM_FRONTS_PER_SYSTEM (200),
  // so seeding 150 visible custom fronts should round-trip every row.
  it("returns more than the legacy cap of 100 visible custom fronts", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketId = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketId);

    const TOTAL = 150;
    const customFrontIds: CustomFrontId[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const id = await insertCustomFront();
      customFrontIds.push(id);
      await insertBucketTag("custom-front", id, bucketId);
    }

    const result = await getFriendDashboard(asDb(db), friendConnectionId, friendAuth);

    expect(result.visibleCustomFronts).toHaveLength(TOTAL);
    const returnedIds = new Set(result.visibleCustomFronts.map((cf) => cf.id));
    for (const id of customFrontIds) {
      expect(returnedIds.has(id)).toBe(true);
    }
  }, 30_000);

  // Regression for api-5y16: queryVisibleStructureEntities was also capped at
  // MAX_PAGE_LIMIT (100). Cap is now MAX_INNERWORLD_ENTITIES_PER_SYSTEM (500),
  // so seeding 150 entities should round-trip every row.
  it("returns more than the legacy cap of 100 visible structure entities", async () => {
    const { ownerConnectionId, friendConnectionId } = await insertBilateralConnections();
    const bucketId = await insertBucket();
    await insertBucketAssignment(ownerConnectionId, bucketId);

    const entityTypeId = await insertStructureEntityType();

    const TOTAL = 150;
    const entityIds: SystemStructureEntityId[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const id = await insertStructureEntity(entityTypeId, i);
      entityIds.push(id);
      await insertBucketTag("structure-entity", id, bucketId);
    }

    const result = await getFriendDashboard(asDb(db), friendConnectionId, friendAuth);

    expect(result.visibleStructureEntities).toHaveLength(TOTAL);
    const returnedIds = new Set(result.visibleStructureEntities.map((e) => e.id));
    for (const id of entityIds) {
      expect(returnedIds.has(id)).toBe(true);
    }
  }, 30_000);

  it("returns 404 for non-existent connection", async () => {
    const fakeConnectionId = brandId<FriendConnectionId>(createId(ID_PREFIXES.friendConnection));

    await assertApiError(
      getFriendDashboard(asDb(db), fakeConnectionId, friendAuth),
      "NOT_FOUND",
      404,
    );
  });

  it("returns 404 for blocked connection", async () => {
    const { friendConnectionId } = await insertBilateralConnections();

    // Update the friend's connection to blocked
    await db
      .update(friendConnections)
      .set({ status: "blocked" as const })
      .where(eq(friendConnections.id, friendConnectionId));

    await assertApiError(
      getFriendDashboard(asDb(db), friendConnectionId, friendAuth),
      "NOT_FOUND",
      404,
    );
  });
});
