import Database from "better-sqlite3";
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
  layers,
  sideSystemLayerLinks,
  sideSystems,
  subsystemLayerLinks,
  subsystemSideSystemLinks,
  subsystems,
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
  getStructureCrossLinks,
  getUnconfirmedAcknowledgements,
} from "../views/sqlite.js";

import {
  SQLITE_DDL,
  sqliteInsertAccount,
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
    client.exec(SQLITE_DDL.subsystems);
    client.exec(SQLITE_DDL.subsystemsIndexes);
    client.exec(SQLITE_DDL.sideSystems);
    client.exec(SQLITE_DDL.sideSystemsIndexes);
    client.exec(SQLITE_DDL.layers);
    client.exec(SQLITE_DDL.layersIndexes);
    client.exec(SQLITE_DDL.subsystemLayerLinks);
    client.exec(SQLITE_DDL.subsystemLayerLinksIndexes);
    client.exec(SQLITE_DDL.subsystemSideSystemLinks);
    client.exec(SQLITE_DDL.subsystemSideSystemLinksIndexes);
    client.exec(SQLITE_DDL.sideSystemLayerLinks);
    client.exec(SQLITE_DDL.sideSystemLayerLinksIndexes);
  });

  afterAll(() => {
    client.close();
  });

  let accountId: string;
  let systemId: string;

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
      "side_system_layer_links",
      "subsystem_side_system_links",
      "subsystem_layer_links",
      "layers",
      "side_systems",
      "subsystems",
      "members",
      "systems",
      "accounts",
    ]) {
      client.exec(`DELETE FROM ${table}`);
    }
    accountId = insertAccount();
    systemId = insertSystem(accountId);
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
          name: "Active key",
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
          name: "Revoked key",
          keyType: "metadata",
          tokenHash: `hash_${crypto.randomUUID()}`,
          scopes: ["read:members"],
          createdAt: now,
          revokedAt: now,
        })
        .run();

      const active = getActiveApiKeys(db, accountId);
      expect(active).toHaveLength(1);
      expect(active[0]?.name).toBe("Active key");
    });
  });

  describe("getPendingFriendRequests", () => {
    it("returns empty array when no requests", () => {
      const pending = getPendingFriendRequests(db, systemId);
      expect(pending).toHaveLength(0);
    });

    it("returns only pending connections", () => {
      const now = Date.now();
      const otherAccountId1 = insertAccount();
      const otherSystemId1 = insertSystem(otherAccountId1);
      const otherAccountId2 = insertAccount();
      const otherSystemId2 = insertSystem(otherAccountId2);

      db.insert(friendConnections)
        .values({
          id: crypto.randomUUID(),
          systemId: otherSystemId1,
          friendSystemId: systemId,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(friendConnections)
        .values({
          id: crypto.randomUUID(),
          systemId: otherSystemId2,
          friendSystemId: systemId,
          status: "accepted",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const pending = getPendingFriendRequests(db, systemId);
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
        })
        .run();
      db.insert(acknowledgements)
        .values({
          id: crypto.randomUUID(),
          systemId,
          confirmed: true,
          confirmedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
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
      const active = getActiveFriendConnections(db, systemId);
      expect(active).toHaveLength(0);
    });

    it("returns only accepted connections", () => {
      const now = Date.now();
      const otherAccountId = insertAccount();
      const otherSystemId = insertSystem(otherAccountId);

      db.insert(friendConnections)
        .values({
          id: crypto.randomUUID(),
          systemId,
          friendSystemId: otherSystemId,
          status: "accepted",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const active = getActiveFriendConnections(db, systemId);
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
            startTime: now - 60000,
            endTime: null,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          },
          {
            id: endedSessionId,
            systemId,
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
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          },
          {
            id: crypto.randomUUID(),
            frontingSessionId: endedSessionId,
            systemId,
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
          { id: sourceSession, accountId, createdAt: now },
          { id: targetSession, accountId, createdAt: now },
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
          createdAt: now,
          expiresAt: now + 3600000,
        })
        .run();

      // Pending but expired
      const sourceSession2 = crypto.randomUUID();
      const targetSession2 = crypto.randomUUID();
      db.insert(sessions)
        .values([
          { id: sourceSession2, accountId, createdAt: now },
          { id: targetSession2, accountId, createdAt: now },
        ])
        .run();
      db.insert(deviceTransferRequests)
        .values({
          id: crypto.randomUUID(),
          accountId,
          sourceSessionId: sourceSession2,
          targetSessionId: targetSession2,
          status: "pending",
          createdAt: now - 7200000,
          expiresAt: now - 3600000,
        })
        .run();

      const active = getActiveDeviceTransfers(db, accountId);
      expect(active).toHaveLength(1);
      expect(active[0]?.expiresAt).toBeGreaterThan(now);
    });
  });

  describe("getStructureCrossLinks", () => {
    it("returns empty array when no links", () => {
      const links = getStructureCrossLinks(db, systemId);
      expect(links).toHaveLength(0);
    });

    it("returns UNION of all 3 link types", () => {
      const now = Date.now();
      const subsystemId = crypto.randomUUID();
      const sideSystemId = crypto.randomUUID();
      const layerId = crypto.randomUUID();

      db.insert(subsystems)
        .values({
          id: subsystemId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(sideSystems)
        .values({
          id: sideSystemId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(layers)
        .values({
          id: layerId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(subsystemLayerLinks)
        .values({ id: crypto.randomUUID(), subsystemId, layerId, systemId, createdAt: now })
        .run();
      db.insert(subsystemSideSystemLinks)
        .values({ id: crypto.randomUUID(), subsystemId, sideSystemId, systemId, createdAt: now })
        .run();
      db.insert(sideSystemLayerLinks)
        .values({ id: crypto.randomUUID(), sideSystemId, layerId, systemId, createdAt: now })
        .run();

      const links = getStructureCrossLinks(db, systemId);
      expect(links).toHaveLength(3);
      const types = links.map((l) => l.linkType).sort();
      expect(types).toEqual(["side-system-layer", "subsystem-layer", "subsystem-side-system"]);
    });
  });
});
