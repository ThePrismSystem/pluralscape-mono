import { brandId, toUnixMillis } from "@pluralscape/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { deviceTransferRequests, sessions } from "../schema/pg/auth.js";
import { frontingComments, frontingSessions } from "../schema/pg/fronting.js";
import { groupMemberships, groups } from "../schema/pg/groups.js";
import { members } from "../schema/pg/members.js";
import { deviceTokens } from "../schema/pg/notifications.js";
import { friendConnections } from "../schema/pg/privacy.js";
import {
  systemStructureEntityAssociations,
  systemStructureEntities,
  systemStructureEntityTypes,
} from "../schema/pg/structure.js";
import {
  getActiveDeviceTokens,
  getActiveDeviceTransfers,
  getActiveFriendConnections,
  getCurrentFrontingComments,
  getMemberGroupSummary,
  getStructureEntityAssociations,
} from "../views/pg.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { pgInsertAccount, pgInsertMember, pgInsertSystem, testBlob } from "./helpers/pg-helpers.js";
import {
  clearViewsTables,
  seedViewsBaseEntities,
  setupViewsFixture,
  teardownViewsFixture,
  type ViewsFixture,
} from "./helpers/views-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type {
  AccountId,
  DeviceTokenId,
  DeviceTransferRequestId,
  FriendConnectionId,
  FrontingCommentId,
  FrontingSessionId,
  GroupId,
  MemberId,
  ServerInternal,
  SessionId,
  SystemId,
  SystemStructureEntityAssociationId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
  UnixMillis,
} from "@pluralscape/types";

describe("PG views — membership, devices, structure", () => {
  let fixture: ViewsFixture;
  let client: PGlite;
  let db: ViewsFixture["db"];
  let accountId: AccountId;
  let systemId: SystemId;
  let memberId: MemberId;

  const insertAccount = (id?: string): Promise<AccountId> => pgInsertAccount(db, id);
  const insertSystem = (acctId: AccountId, id?: string): Promise<SystemId> =>
    pgInsertSystem(db, acctId, id);

  beforeAll(async () => {
    fixture = await setupViewsFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownViewsFixture(fixture);
  });

  beforeEach(async () => {
    await clearViewsTables(client);
    const seed = await seedViewsBaseEntities(db);
    accountId = seed.accountId;
    systemId = seed.systemId;
    memberId = seed.memberId;
  });

  describe("getMemberGroupSummary", () => {
    it("returns correct member count per group", async () => {
      const now = fixtureNow();
      const memberId1 = brandId<MemberId>(crypto.randomUUID());
      const memberId2 = brandId<MemberId>(crypto.randomUUID());
      const groupId = brandId<GroupId>(crypto.randomUUID());

      await db.insert(members).values([
        {
          id: memberId1,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: memberId2,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(groups).values({
        id: groupId,
        systemId: brandId<SystemId>(systemId),
        sortOrder: 0,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(groupMemberships).values([
        { groupId, memberId: memberId1, systemId, createdAt: now },
        { groupId, memberId: memberId2, systemId, createdAt: now },
      ]);

      const summary = await getMemberGroupSummary(db, systemId);
      expect(summary).toHaveLength(1);
      expect(summary[0]?.memberCount).toBe(2);
    });

    it("returns empty array when no groups", async () => {
      const summary = await getMemberGroupSummary(db, systemId);
      expect(summary).toHaveLength(0);
    });
  });

  describe("getActiveFriendConnections", () => {
    it("returns only accepted connections", async () => {
      const now = fixtureNow();
      const otherAccountId1 = await insertAccount();
      await insertSystem(otherAccountId1);
      const otherAccountId2 = await insertAccount();
      await insertSystem(otherAccountId2);

      await db.insert(friendConnections).values({
        id: brandId<FriendConnectionId>(crypto.randomUUID()),
        accountId,
        friendAccountId: otherAccountId1,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(friendConnections).values({
        id: brandId<FriendConnectionId>(crypto.randomUUID()),
        accountId,
        friendAccountId: otherAccountId2,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });

      const active = await getActiveFriendConnections(db, accountId);
      expect(active).toHaveLength(1);
    });
  });

  describe("getActiveDeviceTokens", () => {
    it("returns non-revoked tokens", async () => {
      const now = fixtureNow();

      await db.insert(deviceTokens).values({
        id: brandId<DeviceTokenId>(crypto.randomUUID()),
        accountId,
        systemId,
        platform: "ios",
        tokenHash: `tokenHash_${crypto.randomUUID()}`.slice(0, 64),
        createdAt: now,
      });
      await db.insert(deviceTokens).values({
        id: brandId<DeviceTokenId>(crypto.randomUUID()),
        accountId,
        systemId,
        platform: "android",
        tokenHash: `tokenHash_${crypto.randomUUID()}`.slice(0, 64),
        createdAt: now,
        revokedAt: now,
      });

      const active = await getActiveDeviceTokens(db, accountId);
      expect(active).toHaveLength(1);
      expect(active[0]?.platform).toBe("ios");
    });
  });

  describe("getActiveDeviceTransfers", () => {
    it("returns pending non-expired transfers", async () => {
      const now = fixtureNow();
      const sourceSession = brandId<SessionId>(crypto.randomUUID());
      const targetSession = brandId<SessionId>(crypto.randomUUID());

      await db.insert(sessions).values([
        { id: sourceSession, accountId, tokenHash: `tok_${crypto.randomUUID()}`, createdAt: now },
        { id: targetSession, accountId, tokenHash: `tok_${crypto.randomUUID()}`, createdAt: now },
      ]);

      // Pending, not expired
      await db.insert(deviceTransferRequests).values({
        id: brandId<DeviceTransferRequestId>(crypto.randomUUID()),
        accountId,
        sourceSessionId: sourceSession,
        targetSessionId: targetSession,
        status: "pending",
        codeSalt: new Uint8Array(16),
        createdAt: now,
        expiresAt: toUnixMillis(now + 3600000),
      });

      // Pending but expired
      const sourceSession2 = brandId<SessionId>(crypto.randomUUID());
      const targetSession2 = brandId<SessionId>(crypto.randomUUID());
      await db.insert(sessions).values([
        { id: sourceSession2, accountId, tokenHash: `tok_${crypto.randomUUID()}`, createdAt: now },
        { id: targetSession2, accountId, tokenHash: `tok_${crypto.randomUUID()}`, createdAt: now },
      ]);
      await db.insert(deviceTransferRequests).values({
        id: brandId<DeviceTransferRequestId>(crypto.randomUUID()),
        accountId,
        sourceSessionId: sourceSession2,
        targetSessionId: targetSession2,
        status: "pending",
        codeSalt: new Uint8Array(16),
        createdAt: toUnixMillis(now - 7200000),
        expiresAt: toUnixMillis(now - 3600000),
      });

      const active = await getActiveDeviceTransfers(db, accountId);
      expect(active).toHaveLength(1);
      expect(active[0]?.expiresAt).toBeGreaterThan(now);
    });
  });

  describe("getCurrentFrontingComments", () => {
    it("returns comments only for active sessions", async () => {
      const now = fixtureNow();
      const activeSessionId = brandId<FrontingSessionId>(crypto.randomUUID());
      const endedSessionId = brandId<FrontingSessionId>(crypto.randomUUID());

      await db.insert(frontingSessions).values([
        {
          id: activeSessionId,
          systemId,
          memberId,
          startTime: toUnixMillis(now - 60000),
          endTime: null,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: endedSessionId,
          systemId,
          memberId,
          startTime: toUnixMillis(now - 120000),
          endTime: toUnixMillis(now - 30000),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(frontingComments).values([
        {
          id: brandId<FrontingCommentId>(crypto.randomUUID()),
          frontingSessionId: activeSessionId,
          systemId,
          sessionStartTime: toUnixMillis(now - 60000) as ServerInternal<UnixMillis>,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: brandId<FrontingCommentId>(crypto.randomUUID()),
          frontingSessionId: endedSessionId,
          systemId,
          sessionStartTime: toUnixMillis(now - 120000) as ServerInternal<UnixMillis>,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const comments = await getCurrentFrontingComments(db, systemId);
      expect(comments).toHaveLength(1);
      expect(comments[0]?.frontingSessionId).toBe(activeSessionId);
    });

    it("returns empty array when no comments", async () => {
      const comments = await getCurrentFrontingComments(db, systemId);
      expect(comments).toHaveLength(0);
    });

    it("excludes comments with matching sessionId but mismatched systemId", async () => {
      const now = fixtureNow();
      const sessionIdA = brandId<FrontingSessionId>(crypto.randomUUID());
      const sessionIdB = brandId<FrontingSessionId>(crypto.randomUUID());
      const startTimeA = toUnixMillis(now - 60000);
      const startTimeB = toUnixMillis(now - 90000);

      // Create session in system A
      await db.insert(frontingSessions).values({
        id: sessionIdA,
        systemId,
        memberId,
        startTime: startTimeA,
        endTime: null,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      // Create system B with its own member and session
      const otherAccountId = await insertAccount();
      const otherSystemId = await insertSystem(otherAccountId);
      const otherMemberId = await pgInsertMember(db, otherSystemId);

      await db.insert(frontingSessions).values({
        id: sessionIdB,
        systemId: otherSystemId,
        memberId: otherMemberId,
        startTime: startTimeB,
        endTime: null,
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: now,
        updatedAt: now,
      });

      // Comment on system A's session
      await db.insert(frontingComments).values({
        id: brandId<FrontingCommentId>(crypto.randomUUID()),
        frontingSessionId: sessionIdA,
        systemId,
        sessionStartTime: startTimeA as ServerInternal<UnixMillis>,
        memberId,
        encryptedData: testBlob(new Uint8Array([3])),
        createdAt: now,
        updatedAt: now,
      });

      // Comment on system B's session
      await db.insert(frontingComments).values({
        id: brandId<FrontingCommentId>(crypto.randomUUID()),
        frontingSessionId: sessionIdB,
        systemId: otherSystemId,
        sessionStartTime: startTimeB as ServerInternal<UnixMillis>,
        memberId: otherMemberId,
        encryptedData: testBlob(new Uint8Array([4])),
        createdAt: now,
        updatedAt: now,
      });

      // Query for system A — should only see system A's comment
      const commentsA = await getCurrentFrontingComments(db, systemId);
      expect(commentsA).toHaveLength(1);
      expect(commentsA[0]?.systemId).toBe(systemId);

      // Query for system B — should only see system B's comment
      const commentsB = await getCurrentFrontingComments(db, otherSystemId);
      expect(commentsB).toHaveLength(1);
      expect(commentsB[0]?.systemId).toBe(otherSystemId);
    });
  });

  describe("getStructureEntityAssociations", () => {
    it("returns associations for a system", async () => {
      const now = fixtureNow();
      const entityTypeId = brandId<SystemStructureEntityTypeId>(crypto.randomUUID());
      const entityId1 = brandId<SystemStructureEntityId>(crypto.randomUUID());
      const entityId2 = brandId<SystemStructureEntityId>(crypto.randomUUID());

      await db.insert(systemStructureEntityTypes).values({
        id: entityTypeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values([
        {
          id: entityId1,
          systemId,
          entityTypeId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: entityId2,
          systemId,
          entityTypeId,
          sortOrder: 1,
          encryptedData: testBlob(new Uint8Array([2])),
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(systemStructureEntityAssociations).values({
        id: brandId<SystemStructureEntityAssociationId>(crypto.randomUUID()),
        systemId,
        sourceEntityId: entityId1,
        targetEntityId: entityId2,
        createdAt: now,
      });

      const assocs = await getStructureEntityAssociations(db, systemId);
      expect(assocs).toHaveLength(1);
      expect(assocs[0]?.sourceEntityId).toBe(entityId1);
      expect(assocs[0]?.targetEntityId).toBe(entityId2);
    });

    it("returns empty array when no associations", async () => {
      const assocs = await getStructureEntityAssociations(db, systemId);
      expect(assocs).toHaveLength(0);
    });
  });
});
