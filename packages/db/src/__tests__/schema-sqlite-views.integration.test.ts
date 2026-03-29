import Database from "better-sqlite3-multiple-ciphers";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { apiKeys } from "../schema/sqlite/api-keys.js";
import { deviceTransferRequests, sessions } from "../schema/sqlite/auth.js";
import { acknowledgements } from "../schema/sqlite/communication.js";
import { frontingComments, frontingSessions } from "../schema/sqlite/fronting.js";
import { groupMemberships, groups } from "../schema/sqlite/groups.js";
import { members } from "../schema/sqlite/members.js";
import { deviceTokens } from "../schema/sqlite/notifications.js";
import { friendConnections } from "../schema/sqlite/privacy.js";
import {
  systemStructureEntityAssociations,
  systemStructureEntities,
  systemStructureEntityTypes,
} from "../schema/sqlite/structure.js";
import { webhookConfigs, webhookDeliveries } from "../schema/sqlite/webhooks.js";
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
} from "../views/sqlite.js";

import {
  SQLITE_DDL,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

describe("SQLite views / query helpers", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client);
    // Create all tables needed by the views
    client.exec(SQLITE_DDL.accounts);
    client.exec(SQLITE_DDL.authKeys);
    client.exec(SQLITE_DDL.sessions);
    client.exec(SQLITE_DDL.sessionsIndexes);
    client.exec(SQLITE_DDL.deviceTransferRequests);
    client.exec(SQLITE_DDL.deviceTransferRequestsIndexes);
    client.exec(SQLITE_DDL.systems);
    client.exec(SQLITE_DDL.systemsIndexes);
    client.exec(SQLITE_DDL.members);
    client.exec(SQLITE_DDL.customFronts);
    client.exec(SQLITE_DDL.customFrontsIndexes);
    client.exec(SQLITE_DDL.frontingSessions);
    client.exec(SQLITE_DDL.frontingSessionsIndexes);
    client.exec(SQLITE_DDL.frontingComments);
    client.exec(SQLITE_DDL.frontingCommentsIndexes);
    client.exec(SQLITE_DDL.buckets);
    client.exec(SQLITE_DDL.friendConnections);
    client.exec(SQLITE_DDL.friendConnectionsIndexes);
    client.exec(SQLITE_DDL.apiKeys);
    client.exec(SQLITE_DDL.apiKeysIndexes);
    client.exec(SQLITE_DDL.acknowledgements);
    client.exec(SQLITE_DDL.acknowledgementsIndexes);
    client.exec(SQLITE_DDL.groups);
    client.exec(SQLITE_DDL.groupsIndexes);
    client.exec(SQLITE_DDL.groupMemberships);
    client.exec(SQLITE_DDL.groupMembershipsIndexes);
    client.exec(SQLITE_DDL.deviceTokens);
    client.exec(SQLITE_DDL.deviceTokensIndexes);
    client.exec(SQLITE_DDL.webhookConfigs);
    client.exec(SQLITE_DDL.webhookConfigsIndexes);
    client.exec(SQLITE_DDL.webhookDeliveries);
    client.exec(SQLITE_DDL.webhookDeliveriesIndexes);
    client.exec(SQLITE_DDL.relationships);
    client.exec(SQLITE_DDL.systemStructureEntityTypes);
    client.exec(SQLITE_DDL.systemStructureEntityTypesIndexes);
    client.exec(SQLITE_DDL.systemStructureEntities);
    client.exec(SQLITE_DDL.systemStructureEntitiesIndexes);
    client.exec(SQLITE_DDL.systemStructureEntityAssociations);
    client.exec(SQLITE_DDL.systemStructureEntityAssociationsIndexes);
  });

  afterAll(() => {
    client.close();
  });

  let accountId: string;
  let systemId: string;
  let memberId: string;

  beforeEach(() => {
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
      "custom_fronts",
      "members",
      "systems",
      "accounts",
    ]) {
      client.exec(`DELETE FROM ${table}`);
    }
    accountId = insertAccount();
    systemId = insertSystem(accountId);
    memberId = sqliteInsertMember(db, systemId);
  });

  describe("getCurrentFronters", () => {
    it("returns empty array when no active sessions", () => {
      const fronters = getCurrentFronters(db, systemId);
      expect(fronters).toHaveLength(0);
    });

    it("returns sessions with null end_time", () => {
      const now = Date.now();
      db.insert(frontingSessions)
        .values({
          id: crypto.randomUUID(),
          systemId,
          memberId,
          startTime: now - 60000,
          endTime: null,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(frontingSessions)
        .values({
          id: crypto.randomUUID(),
          systemId,
          memberId,
          startTime: now - 120000,
          endTime: now - 30000,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const fronters = getCurrentFronters(db, systemId);
      expect(fronters).toHaveLength(1);
      expect(fronters[0]?.startTime).toBe(now - 60000);
    });
  });

  describe("getCurrentFrontersWithDuration", () => {
    it("returns empty array when no active sessions", () => {
      const fronters = getCurrentFrontersWithDuration(db, systemId);
      expect(fronters).toHaveLength(0);
    });

    it("returns positive duration for active sessions", () => {
      const now = Date.now();
      db.insert(frontingSessions)
        .values({
          id: crypto.randomUUID(),
          systemId,
          memberId,
          startTime: now - 60000,
          endTime: null,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const fronters = getCurrentFrontersWithDuration(db, systemId);
      expect(fronters).toHaveLength(1);
      expect(fronters[0]?.durationMs).toBeGreaterThan(0);
    });
  });

  describe("getActiveApiKeys", () => {
    it("returns empty array when no keys", () => {
      const active = getActiveApiKeys(db, accountId);
      expect(active).toHaveLength(0);
    });

    it("returns non-revoked keys and excludes revoked", () => {
      const now = Date.now();
      db.insert(apiKeys)
        .values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          encryptedData: testBlob(),
          keyType: "metadata",
          tokenHash: `hash_${crypto.randomUUID()}`,
          scopes: ["read:members"],
          createdAt: now,
        })
        .run();
      db.insert(apiKeys)
        .values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          encryptedData: testBlob(),
          keyType: "metadata",
          tokenHash: `hash_${crypto.randomUUID()}`,
          scopes: ["read:members"],
          createdAt: now,
          revokedAt: now,
        })
        .run();

      const active = getActiveApiKeys(db, accountId);
      expect(active).toHaveLength(1);
    });
  });

  describe("getPendingFriendRequests", () => {
    it("returns empty array when no requests", () => {
      const pending = getPendingFriendRequests(db, accountId);
      expect(pending).toHaveLength(0);
    });

    it("returns only pending connections", () => {
      const now = Date.now();
      const otherAccountId1 = insertAccount();
      insertSystem(otherAccountId1);
      const otherAccountId2 = insertAccount();
      insertSystem(otherAccountId2);

      db.insert(friendConnections)
        .values({
          id: crypto.randomUUID(),
          accountId: otherAccountId1,
          friendAccountId: accountId,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(friendConnections)
        .values({
          id: crypto.randomUUID(),
          accountId: otherAccountId2,
          friendAccountId: accountId,
          status: "accepted",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const pending = getPendingFriendRequests(db, accountId);
      expect(pending).toHaveLength(1);
    });
  });

  describe("getPendingWebhookRetries", () => {
    it("returns empty array when no retries", () => {
      const retries = getPendingWebhookRetries(db, systemId, 3);
      expect(retries).toHaveLength(0);
    });

    it("returns failed deliveries under max attempts and respects limit", () => {
      const now = Date.now();
      const webhookId = crypto.randomUUID();
      const maxAttempts = 3;
      db.insert(webhookConfigs)
        .values({
          id: webhookId,
          systemId,
          url: "https://example.com/hook",
          secret: new Uint8Array([1, 2, 3]),
          eventTypes: ["member.created"],
          createdAt: now,
          updatedAt: now,
        })
        .run();
      // Under limit, nextRetryAt in the past
      db.insert(webhookDeliveries)
        .values({
          id: crypto.randomUUID(),
          webhookId,
          systemId,
          eventType: "member.created",
          status: "failed",
          attemptCount: 2,
          nextRetryAt: now - 60000,
          payloadData: { test: true },
          createdAt: now,
        })
        .run();
      // Over limit, nextRetryAt in the past
      db.insert(webhookDeliveries)
        .values({
          id: crypto.randomUUID(),
          webhookId,
          systemId,
          eventType: "member.created",
          status: "failed",
          attemptCount: 5,
          nextRetryAt: now - 60000,
          payloadData: { test: true },
          createdAt: now,
        })
        .run();
      // Under limit but nextRetryAt in the future — should NOT be returned
      db.insert(webhookDeliveries)
        .values({
          id: crypto.randomUUID(),
          webhookId,
          systemId,
          eventType: "member.created",
          status: "failed",
          attemptCount: 2,
          nextRetryAt: now + 60000,
          payloadData: { test: true },
          createdAt: now,
        })
        .run();

      const retries = getPendingWebhookRetries(db, systemId, maxAttempts);
      expect(retries).toHaveLength(1);
      expect(retries[0]?.attemptCount).toBe(2);
    });
  });

  describe("getUnconfirmedAcknowledgements", () => {
    it("returns empty array when none exist", () => {
      const unconfirmed = getUnconfirmedAcknowledgements(db, systemId);
      expect(unconfirmed).toHaveLength(0);
    });

    it("returns only unconfirmed acknowledgements", () => {
      const now = Date.now();
      db.insert(acknowledgements)
        .values({
          id: crypto.randomUUID(),
          systemId,
          confirmed: false,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(acknowledgements)
        .values({
          id: crypto.randomUUID(),
          systemId,
          confirmed: true,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const unconfirmed = getUnconfirmedAcknowledgements(db, systemId);
      expect(unconfirmed).toHaveLength(1);
    });
  });

  describe("getMemberGroupSummary", () => {
    it("returns empty array when no groups", () => {
      const summary = getMemberGroupSummary(db, systemId);
      expect(summary).toHaveLength(0);
    });

    it("returns groups with correct member counts", () => {
      const now = Date.now();
      const memberId1 = crypto.randomUUID();
      const memberId2 = crypto.randomUUID();
      const groupId = crypto.randomUUID();

      db.insert(members)
        .values([
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
        ])
        .run();
      db.insert(groups)
        .values({
          id: groupId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(groupMemberships)
        .values([
          { groupId, memberId: memberId1, systemId, createdAt: now },
          { groupId, memberId: memberId2, systemId, createdAt: now },
        ])
        .run();

      const summary = getMemberGroupSummary(db, systemId);
      expect(summary).toHaveLength(1);
      expect(summary[0]?.memberCount).toBe(2);
    });
  });

  describe("getActiveFriendConnections", () => {
    it("returns empty array when no accepted connections", () => {
      const active = getActiveFriendConnections(db, accountId);
      expect(active).toHaveLength(0);
    });

    it("returns only accepted connections", () => {
      const now = Date.now();
      const otherAccountId = insertAccount();
      insertSystem(otherAccountId);

      db.insert(friendConnections)
        .values({
          id: crypto.randomUUID(),
          accountId,
          friendAccountId: otherAccountId,
          status: "accepted",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const active = getActiveFriendConnections(db, accountId);
      expect(active).toHaveLength(1);
    });
  });

  describe("getActiveDeviceTokens", () => {
    it("returns empty array when no tokens", () => {
      const active = getActiveDeviceTokens(db, accountId);
      expect(active).toHaveLength(0);
    });

    it("returns non-revoked tokens with token field", () => {
      const now = Date.now();
      const tokenValue = `token_${crypto.randomUUID()}`;
      db.insert(deviceTokens)
        .values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          platform: "ios",
          token: tokenValue,
          createdAt: now,
        })
        .run();
      db.insert(deviceTokens)
        .values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          platform: "android",
          token: `token_${crypto.randomUUID()}`,
          createdAt: now,
          revokedAt: now,
        })
        .run();

      const active = getActiveDeviceTokens(db, accountId);
      expect(active).toHaveLength(1);
      expect(active[0]?.platform).toBe("ios");
    });
  });

  describe("getCurrentFrontingComments", () => {
    it("returns empty array when no comments", () => {
      const comments = getCurrentFrontingComments(db, systemId);
      expect(comments).toHaveLength(0);
    });

    it("returns comments only for active sessions", () => {
      const now = Date.now();
      const activeSessionId = crypto.randomUUID();
      const endedSessionId = crypto.randomUUID();

      db.insert(frontingSessions)
        .values([
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
        ])
        .run();
      db.insert(frontingComments)
        .values([
          {
            id: crypto.randomUUID(),
            frontingSessionId: activeSessionId,
            systemId,
            memberId,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          },
          {
            id: crypto.randomUUID(),
            frontingSessionId: endedSessionId,
            systemId,
            memberId,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          },
        ])
        .run();

      const comments = getCurrentFrontingComments(db, systemId);
      expect(comments).toHaveLength(1);
      expect(comments[0]?.frontingSessionId).toBe(activeSessionId);
    });
  });

  describe("getActiveDeviceTransfers", () => {
    it("returns empty array when no transfers", () => {
      const active = getActiveDeviceTransfers(db, accountId);
      expect(active).toHaveLength(0);
    });

    it("returns pending non-expired transfers", () => {
      const now = Date.now();
      const sourceSession = crypto.randomUUID();
      const targetSession = crypto.randomUUID();

      db.insert(sessions)
        .values([
          { id: sourceSession, accountId, tokenHash: `tok_${crypto.randomUUID()}`, createdAt: now },
          { id: targetSession, accountId, tokenHash: `tok_${crypto.randomUUID()}`, createdAt: now },
        ])
        .run();

      // Pending, not expired
      db.insert(deviceTransferRequests)
        .values({
          id: crypto.randomUUID(),
          accountId,
          sourceSessionId: sourceSession,
          targetSessionId: targetSession,
          status: "pending",
          codeSalt: new Uint8Array(16),
          createdAt: now,
          expiresAt: now + 3600000,
        })
        .run();

      // Pending but expired
      const sourceSession2 = crypto.randomUUID();
      const targetSession2 = crypto.randomUUID();
      db.insert(sessions)
        .values([
          {
            id: sourceSession2,
            accountId,
            tokenHash: `tok_${crypto.randomUUID()}`,
            createdAt: now,
          },
          {
            id: targetSession2,
            accountId,
            tokenHash: `tok_${crypto.randomUUID()}`,
            createdAt: now,
          },
        ])
        .run();
      db.insert(deviceTransferRequests)
        .values({
          id: crypto.randomUUID(),
          accountId,
          sourceSessionId: sourceSession2,
          targetSessionId: targetSession2,
          status: "pending",
          codeSalt: new Uint8Array(16),
          createdAt: now - 7200000,
          expiresAt: now - 3600000,
        })
        .run();

      const active = getActiveDeviceTransfers(db, accountId);
      expect(active).toHaveLength(1);
      expect(active[0]?.expiresAt).toBeGreaterThan(now);
    });
  });

  describe("getStructureEntityAssociations", () => {
    it("returns empty array when no associations", () => {
      const assocs = getStructureEntityAssociations(db, systemId);
      expect(assocs).toHaveLength(0);
    });

    it("returns associations for a system", () => {
      const now = Date.now();
      const entityTypeId = crypto.randomUUID();
      const entityId1 = crypto.randomUUID();
      const entityId2 = crypto.randomUUID();

      db.insert(systemStructureEntityTypes)
        .values({
          id: entityTypeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values([
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
        ])
        .run();
      db.insert(systemStructureEntityAssociations)
        .values({
          id: crypto.randomUUID(),
          systemId,
          sourceEntityId: entityId1,
          targetEntityId: entityId2,
          createdAt: now,
        })
        .run();

      const assocs = getStructureEntityAssociations(db, systemId);
      expect(assocs).toHaveLength(1);
      expect(assocs[0]?.sourceEntityId).toBe(entityId1);
      expect(assocs[0]?.targetEntityId).toBe(entityId2);
    });
  });
});
