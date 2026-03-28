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
import { createId, ID_PREFIXES, now } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getFriendDashboard } from "../../services/friend-dashboard.service.js";
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

    ownerAccountId = (await pgInsertAccount(db)) as AccountId;
    friendAccountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, ownerAccountId)) as SystemId;
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
    await db.delete(buckets);
  });

  // ── Helpers ─────────────────────────────────────────────────────────

  /** Create bilateral friend connections (owner -> friend and friend -> owner). */
  async function insertBilateralConnections(): Promise<{
    ownerConnectionId: FriendConnectionId;
    friendConnectionId: FriendConnectionId;
  }> {
    const ownerConnectionId = createId(ID_PREFIXES.friendConnection) as FriendConnectionId;
    const friendConnectionId = createId(ID_PREFIXES.friendConnection) as FriendConnectionId;
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
    return id as BucketId;
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
    return id as KeyGrantId;
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
    return id as MemberId;
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
    return id as CustomFrontId;
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
    const id = createId(ID_PREFIXES.frontingSession);
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
    return id as FrontingSessionId;
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
    expect(result.memberCount).toBeGreaterThanOrEqual(1);
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

    // Insert a member so memberCount is nonzero, but with no bucket assignments
    // the filtered arrays should be empty
    await insertMember();

    const result = await getFriendDashboard(asDb(db), friendConnectionId, friendAuth);

    expect(result.systemId).toBe(systemId);
    expect(result.memberCount).toBeGreaterThanOrEqual(1);
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

  it("returns 404 for non-existent connection", async () => {
    const fakeConnectionId = createId(ID_PREFIXES.friendConnection) as FriendConnectionId;

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
