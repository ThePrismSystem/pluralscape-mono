import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { apiKeys } from "../schema/pg/api-keys.js";
import { deviceTransferRequests, sessions } from "../schema/pg/auth.js";
import { acknowledgements } from "../schema/pg/communication.js";
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
import { webhookConfigs, webhookDeliveries } from "../schema/pg/webhooks.js";
import {
  getActiveFriendConnections,
  getActiveApiKeys,
  getActiveDeviceTokens,
  getActiveDeviceTransfers,
  getCurrentFronters,
  getCurrentFrontersWithDuration,
  getCurrentFrontingComments,
  getMemberGroupSummary,
  getPendingFriendRequests,
  getPendingWebhookRetries,
  getStructureEntityAssociations,
  getUnconfirmedAcknowledgements,
} from "../views/pg.js";

import {
  PG_DDL,
  pgExec,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type {
  AccountId,
  AcknowledgementId,
  ApiKeyId,
  DeviceTransferRequestId,
  FriendConnectionId,
  FrontingCommentId,
  FrontingSessionId,
  GroupId,
  ServerSecret,
  SessionId,
  SystemId,
  SystemStructureEntityAssociationId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
  WebhookDeliveryId,
  WebhookId,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

describe("PG views / query helpers", () => {
  let client: PGlite;
  let db: PgliteDatabase;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: AccountId, id?: string) => pgInsertSystem(db, accountId, id);

  let accountId: AccountId;
  let systemId: SystemId;
  let memberId: string;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);
    // Base tables (only once)
    await pgExec(client, PG_DDL.accounts);
    await pgExec(client, PG_DDL.systems);
    await pgExec(client, PG_DDL.systemsIndexes);
    // Sessions & device transfer requests
    await pgExec(client, PG_DDL.sessions);
    await pgExec(client, PG_DDL.sessionsIndexes);
    await pgExec(client, PG_DDL.deviceTransferRequests);
    await pgExec(client, PG_DDL.deviceTransferRequestsIndexes);
    // Members (needed for groups)
    await pgExec(client, PG_DDL.members);
    // Structure (needed for fronting FKs)
    await pgExec(client, PG_DDL.systemStructureEntityTypes);
    await pgExec(client, PG_DDL.systemStructureEntityTypesIndexes);
    await pgExec(client, PG_DDL.systemStructureEntities);
    await pgExec(client, PG_DDL.systemStructureEntitiesIndexes);
    // Fronting
    await pgExec(client, PG_DDL.customFronts);
    await pgExec(client, PG_DDL.customFrontsIndexes);
    await pgExec(client, PG_DDL.frontingSessions);
    await pgExec(client, PG_DDL.frontingSessionsIndexes);
    await pgExec(client, PG_DDL.frontingComments);
    await pgExec(client, PG_DDL.frontingCommentsIndexes);
    // API keys
    await pgExec(client, PG_DDL.apiKeys);
    await pgExec(client, PG_DDL.apiKeysIndexes);
    // Privacy (friend connections)
    await pgExec(client, PG_DDL.buckets);
    await pgExec(client, PG_DDL.friendConnections);
    await pgExec(client, PG_DDL.friendConnectionsIndexes);
    // Communication (acknowledgements)
    await pgExec(client, PG_DDL.acknowledgements);
    await pgExec(client, PG_DDL.acknowledgementsIndexes);
    // Groups
    await pgExec(client, PG_DDL.groups);
    await pgExec(client, PG_DDL.groupsIndexes);
    await pgExec(client, PG_DDL.groupMemberships);
    await pgExec(client, PG_DDL.groupMembershipsIndexes);
    // Notifications (device tokens)
    await pgExec(client, PG_DDL.deviceTokens);
    await pgExec(client, PG_DDL.deviceTokensIndexes);
    // Webhooks
    await pgExec(client, PG_DDL.webhookConfigs);
    await pgExec(client, PG_DDL.webhookConfigsIndexes);
    await pgExec(client, PG_DDL.webhookDeliveries);
    await pgExec(client, PG_DDL.webhookDeliveriesIndexes);
    // Structure (types + entities already created above for fronting FKs)
    await pgExec(client, PG_DDL.relationships);
    await pgExec(client, PG_DDL.systemStructureEntityAssociations);
    await pgExec(client, PG_DDL.systemStructureEntityAssociationsIndexes);
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    // Clean up tables for each test (FK-safe order: children first)
    for (const table of [
      "fronting_comments",
      "fronting_sessions",
      "acknowledgements",
      "webhook_deliveries",
      "webhook_configs",
      "device_tokens",
      "friend_connections",
      "group_memberships",
      "groups",
      "api_keys",
      "device_transfer_requests",
      "sessions",
      "system_structure_entity_associations",
      "system_structure_entities",
      "system_structure_entity_types",
      "members",
      "systems",
      "accounts",
    ]) {
      await client.exec(`DELETE FROM ${table}`);
    }
    accountId = await insertAccount();
    systemId = await insertSystem(accountId);
    memberId = await pgInsertMember(db, systemId);
  });

  describe("getCurrentFronters", () => {
    it("returns sessions with null end_time", async () => {
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id: brandId<FrontingSessionId>(crypto.randomUUID()),
        systemId,
        memberId,
        startTime: now - 60000,
        endTime: null,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(frontingSessions).values({
        id: brandId<FrontingSessionId>(crypto.randomUUID()),
        systemId,
        memberId,
        startTime: now - 120000,
        endTime: now - 30000,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const fronters = await getCurrentFronters(db, systemId);
      expect(fronters).toHaveLength(1);
      expect(fronters[0]?.startTime).toBe(now - 60000);
    });

    it("returns empty array when no active sessions", async () => {
      const fronters = await getCurrentFronters(db, systemId);
      expect(fronters).toHaveLength(0);
    });
  });

  describe("getCurrentFrontersWithDuration", () => {
    it("returns positive duration for active sessions", async () => {
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id: brandId<FrontingSessionId>(crypto.randomUUID()),
        systemId,
        memberId,
        startTime: now - 60000,
        endTime: null,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const fronters = await getCurrentFrontersWithDuration(db, systemId);
      expect(fronters).toHaveLength(1);
      expect(fronters[0]?.durationMs).toBeGreaterThan(0);
    });

    it("returns empty array when no active sessions", async () => {
      const fronters = await getCurrentFrontersWithDuration(db, systemId);
      expect(fronters).toHaveLength(0);
    });
  });

  describe("getActiveApiKeys", () => {
    it("returns non-revoked keys", async () => {
      const now = Date.now();

      await db.insert(apiKeys).values({
        id: brandId<ApiKeyId>(crypto.randomUUID()),
        accountId,
        systemId,
        encryptedData: testBlob(),
        keyType: "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["read:members"],
        createdAt: now,
      });
      await db.insert(apiKeys).values({
        id: brandId<ApiKeyId>(crypto.randomUUID()),
        accountId,
        systemId,
        encryptedData: testBlob(),
        keyType: "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["read:members"],
        createdAt: now,
        revokedAt: now,
      });

      const active = await getActiveApiKeys(db, accountId);
      expect(active).toHaveLength(1);
    });

    it("returns empty array when no keys exist", async () => {
      const active = await getActiveApiKeys(db, accountId);
      expect(active).toHaveLength(0);
    });

    it("includes key with encryptedData", async () => {
      const now = Date.now();

      await db.insert(apiKeys).values({
        id: brandId<ApiKeyId>(crypto.randomUUID()),
        accountId,
        systemId,
        keyType: "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["read:members"],
        encryptedData: testBlob(),
        createdAt: now,
      });

      const active = await getActiveApiKeys(db, accountId);
      expect(active).toHaveLength(1);
    });
  });

  describe("getPendingFriendRequests", () => {
    it("returns only pending connections", async () => {
      const otherAccountId1 = await insertAccount();
      await insertSystem(otherAccountId1);
      const otherAccountId2 = await insertAccount();
      await insertSystem(otherAccountId2);
      const now = Date.now();

      await db.insert(friendConnections).values({
        id: brandId<FriendConnectionId>(crypto.randomUUID()),
        accountId: otherAccountId1,
        friendAccountId: accountId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(friendConnections).values({
        id: brandId<FriendConnectionId>(crypto.randomUUID()),
        accountId: otherAccountId2,
        friendAccountId: accountId,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      const pending = await getPendingFriendRequests(db, accountId);
      expect(pending).toHaveLength(1);
    });

    it("returns empty array when no pending requests", async () => {
      const pending = await getPendingFriendRequests(db, accountId);
      expect(pending).toHaveLength(0);
    });
  });

  describe("getPendingWebhookRetries", () => {
    it("respects max_attempts parameter", async () => {
      const now = Date.now();
      const webhookId = brandId<WebhookId>(crypto.randomUUID());
      const maxAttempts = 3;

      await db.insert(webhookConfigs).values({
        id: webhookId,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([1, 2, 3]) as ServerSecret,
        eventTypes: ["member.created"],
        createdAt: now,
        updatedAt: now,
      });
      // Under limit, nextRetryAt in the past
      await db.insert(webhookDeliveries).values({
        id: brandId<WebhookDeliveryId>(crypto.randomUUID()),
        webhookId,
        systemId,
        eventType: "member.created",
        status: "failed",
        attemptCount: 2,
        nextRetryAt: now - 60000,
        encryptedData: new Uint8Array([1, 2, 3]),
        createdAt: now,
      });
      // Over limit, nextRetryAt in the past
      await db.insert(webhookDeliveries).values({
        id: brandId<WebhookDeliveryId>(crypto.randomUUID()),
        webhookId,
        systemId,
        eventType: "member.created",
        status: "failed",
        attemptCount: 5,
        nextRetryAt: now - 60000,
        encryptedData: new Uint8Array([1, 2, 3]),
        createdAt: now,
      });
      // Under limit but nextRetryAt in the future — should NOT be returned
      await db.insert(webhookDeliveries).values({
        id: brandId<WebhookDeliveryId>(crypto.randomUUID()),
        webhookId,
        systemId,
        eventType: "member.created",
        status: "failed",
        attemptCount: 2,
        nextRetryAt: now + 60000,
        encryptedData: new Uint8Array([1, 2, 3]),
        createdAt: now,
      });

      const retries = await getPendingWebhookRetries(db, systemId, maxAttempts);
      expect(retries).toHaveLength(1);
      expect(retries[0]?.attemptCount).toBe(2);
    });

    it("returns empty array when no retries needed", async () => {
      const retries = await getPendingWebhookRetries(db, systemId, 3);
      expect(retries).toHaveLength(0);
    });
  });

  describe("getUnconfirmedAcknowledgements", () => {
    it("returns only unconfirmed", async () => {
      const now = Date.now();

      await db.insert(acknowledgements).values({
        id: brandId<AcknowledgementId>(crypto.randomUUID()),
        systemId,
        confirmed: false,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(acknowledgements).values({
        id: brandId<AcknowledgementId>(crypto.randomUUID()),
        systemId,
        confirmed: true,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const unconfirmed = await getUnconfirmedAcknowledgements(db, systemId);
      expect(unconfirmed).toHaveLength(1);
    });

    it("returns empty array when all confirmed", async () => {
      const unconfirmed = await getUnconfirmedAcknowledgements(db, systemId);
      expect(unconfirmed).toHaveLength(0);
    });
  });

  describe("getMemberGroupSummary", () => {
    it("returns correct member count per group", async () => {
      const now = Date.now();
      const memberId1 = crypto.randomUUID();
      const memberId2 = crypto.randomUUID();
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
      const now = Date.now();
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
      const now = Date.now();

      await db.insert(deviceTokens).values({
        id: brandId<FrontingSessionId>(crypto.randomUUID()),
        accountId,
        systemId,
        platform: "ios",
        tokenHash: `tokenHash_${crypto.randomUUID()}`.slice(0, 64),
        createdAt: now,
      });
      await db.insert(deviceTokens).values({
        id: brandId<FrontingSessionId>(crypto.randomUUID()),
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
      const now = Date.now();
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
        expiresAt: now + 3600000,
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
        createdAt: now - 7200000,
        expiresAt: now - 3600000,
      });

      const active = await getActiveDeviceTransfers(db, accountId);
      expect(active).toHaveLength(1);
      expect(active[0]?.expiresAt).toBeGreaterThan(now);
    });
  });

  describe("getCurrentFrontingComments", () => {
    it("returns comments only for active sessions", async () => {
      const now = Date.now();
      const activeSessionId = brandId<FrontingSessionId>(crypto.randomUUID());
      const endedSessionId = brandId<FrontingSessionId>(crypto.randomUUID());

      await db.insert(frontingSessions).values([
        {
          id: activeSessionId,
          systemId,
          memberId,
          startTime: now - 60000,
          endTime: null,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: endedSessionId,
          systemId,
          memberId,
          startTime: now - 120000,
          endTime: now - 30000,
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
          sessionStartTime: now - 60000,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: brandId<FrontingCommentId>(crypto.randomUUID()),
          frontingSessionId: endedSessionId,
          systemId,
          sessionStartTime: now - 120000,
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
      const now = Date.now();
      const sessionIdA = brandId<FrontingSessionId>(crypto.randomUUID());
      const sessionIdB = brandId<FrontingSessionId>(crypto.randomUUID());
      const startTimeA = now - 60000;
      const startTimeB = now - 90000;

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
        sessionStartTime: startTimeA,
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
        sessionStartTime: startTimeB,
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
      const now = Date.now();
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
