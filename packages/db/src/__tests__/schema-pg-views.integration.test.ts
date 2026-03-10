import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { apiKeys } from "../schema/pg/api-keys.js";
import { acknowledgements } from "../schema/pg/communication.js";
import { frontingComments, frontingSessions } from "../schema/pg/fronting.js";
import { groupMemberships, groups } from "../schema/pg/groups.js";
import { members } from "../schema/pg/members.js";
import { friendConnections } from "../schema/pg/privacy.js";
import {
  layers,
  sideSystemLayerLinks,
  sideSystems,
  subsystemLayerLinks,
  subsystemSideSystemLinks,
  subsystems,
} from "../schema/pg/structure.js";
import { webhookConfigs, webhookDeliveries } from "../schema/pg/webhooks.js";
import {
  getActiveApiKeys,
  getCurrentFronters,
  getCurrentFrontersWithDuration,
  getCurrentFrontingComments,
  getMemberGroupSummary,
  getPendingFriendRequests,
  getPendingWebhookRetries,
  getStructureCrossLinks,
  getUnconfirmedAcknowledgements,
} from "../views/pg.js";

import { PG_DDL, pgInsertAccount, pgInsertSystem } from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

/** Execute one or more semicolon-separated SQL statements. */
async function pgExec(client: PGlite, sqlText: string): Promise<void> {
  const stmts = sqlText
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of stmts) {
    await client.exec(stmt);
  }
}

describe("PG views / query helpers", () => {
  let client: PGlite;
  let db: PgliteDatabase;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);
    // Base tables (only once)
    await pgExec(client, PG_DDL.accounts);
    await pgExec(client, PG_DDL.systems);
    await pgExec(client, PG_DDL.systemsIndexes);
    // Members (needed for groups)
    await pgExec(client, PG_DDL.members);
    // Fronting
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
    // Webhooks
    await pgExec(client, PG_DDL.webhookConfigs);
    await pgExec(client, PG_DDL.webhookConfigsIndexes);
    await pgExec(client, PG_DDL.webhookDeliveries);
    await pgExec(client, PG_DDL.webhookDeliveriesIndexes);
    // Structure
    await pgExec(client, PG_DDL.relationships);
    await pgExec(client, PG_DDL.subsystems);
    await pgExec(client, PG_DDL.subsystemsIndexes);
    await pgExec(client, PG_DDL.sideSystems);
    await pgExec(client, PG_DDL.sideSystemsIndexes);
    await pgExec(client, PG_DDL.layers);
    await pgExec(client, PG_DDL.layersIndexes);
    await pgExec(client, PG_DDL.subsystemLayerLinks);
    await pgExec(client, PG_DDL.subsystemLayerLinksIndexes);
    await pgExec(client, PG_DDL.subsystemSideSystemLinks);
    await pgExec(client, PG_DDL.subsystemSideSystemLinksIndexes);
    await pgExec(client, PG_DDL.sideSystemLayerLinks);
    await pgExec(client, PG_DDL.sideSystemLayerLinksIndexes);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("getCurrentFronters", () => {
    it("returns sessions with null end_time", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id: crypto.randomUUID(),
        systemId,
        startTime: now - 60000,
        endTime: null,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(frontingSessions).values({
        id: crypto.randomUUID(),
        systemId,
        startTime: now - 120000,
        endTime: now - 30000,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      const fronters = await getCurrentFronters(db, systemId);
      expect(fronters).toHaveLength(1);
      expect(fronters[0]?.startTime).toBe(now - 60000);
    });
  });

  describe("getCurrentFrontersWithDuration", () => {
    it("returns positive duration for active sessions", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await db.insert(frontingSessions).values({
        id: crypto.randomUUID(),
        systemId,
        startTime: now - 60000,
        endTime: null,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      const fronters = await getCurrentFrontersWithDuration(db, systemId);
      expect(fronters).toHaveLength(1);
      expect(fronters[0]?.durationMs).toBeGreaterThan(0);
    });
  });

  describe("getActiveApiKeys", () => {
    it("returns non-revoked keys", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await db.insert(apiKeys).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        name: "Active",
        keyType: "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["read:members"],
        createdAt: now,
      });
      await db.insert(apiKeys).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        name: "Revoked",
        keyType: "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["read:members"],
        createdAt: now,
        revokedAt: now,
      });

      const active = await getActiveApiKeys(db, accountId);
      expect(active).toHaveLength(1);
      expect(active[0]?.name).toBe("Active");
    });
  });

  describe("getPendingFriendRequests", () => {
    it("returns only pending connections", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const otherAccountId1 = await insertAccount();
      const otherSystemId1 = await insertSystem(otherAccountId1);
      const otherAccountId2 = await insertAccount();
      const otherSystemId2 = await insertSystem(otherAccountId2);
      const now = Date.now();

      await db.insert(friendConnections).values({
        id: crypto.randomUUID(),
        systemId,
        friendSystemId: otherSystemId1,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(friendConnections).values({
        id: crypto.randomUUID(),
        systemId,
        friendSystemId: otherSystemId2,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });

      const pending = await getPendingFriendRequests(db, systemId);
      expect(pending).toHaveLength(1);
    });
  });

  describe("getPendingWebhookRetries", () => {
    it("respects max_attempts parameter", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();
      const webhookId = crypto.randomUUID();
      const maxAttempts = 3;

      await db.insert(webhookConfigs).values({
        id: webhookId,
        systemId,
        url: "https://example.com/hook",
        secret: new Uint8Array([1, 2, 3]),
        eventTypes: ["member.created"],
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(webhookDeliveries).values({
        id: crypto.randomUUID(),
        webhookId,
        systemId,
        eventType: "member.created",
        status: "failed",
        attemptCount: 2,
        createdAt: now,
      });
      await db.insert(webhookDeliveries).values({
        id: crypto.randomUUID(),
        webhookId,
        systemId,
        eventType: "member.created",
        status: "failed",
        attemptCount: 5,
        createdAt: now,
      });

      const retries = await getPendingWebhookRetries(db, systemId, maxAttempts);
      expect(retries).toHaveLength(1);
      expect(retries[0]?.attemptCount).toBe(2);
    });
  });

  describe("getUnconfirmedAcknowledgements", () => {
    it("returns only unconfirmed", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await db.insert(acknowledgements).values({
        id: crypto.randomUUID(),
        systemId,
        confirmed: false,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
      });
      await db.insert(acknowledgements).values({
        id: crypto.randomUUID(),
        systemId,
        confirmed: true,
        confirmedAt: now,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
      });

      const unconfirmed = await getUnconfirmedAcknowledgements(db, systemId);
      expect(unconfirmed).toHaveLength(1);
    });
  });

  describe("getMemberGroupSummary", () => {
    it("returns correct member count per group", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();
      const memberId1 = crypto.randomUUID();
      const memberId2 = crypto.randomUUID();
      const groupId = crypto.randomUUID();

      await db.insert(members).values([
        {
          id: memberId1,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: memberId2,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(groups).values({
        id: groupId,
        systemId,
        sortOrder: 0,
        encryptedData: new Uint8Array([1]),
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
  });

  describe("getCurrentFrontingComments", () => {
    it("returns comments only for active sessions", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();
      const activeSessionId = crypto.randomUUID();
      const endedSessionId = crypto.randomUUID();

      await db.insert(frontingSessions).values([
        {
          id: activeSessionId,
          systemId,
          startTime: now - 60000,
          endTime: null,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: endedSessionId,
          systemId,
          startTime: now - 120000,
          endTime: now - 30000,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(frontingComments).values([
        {
          id: crypto.randomUUID(),
          sessionId: activeSessionId,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: crypto.randomUUID(),
          sessionId: endedSessionId,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const comments = await getCurrentFrontingComments(db, systemId);
      expect(comments).toHaveLength(1);
      expect(comments[0]?.sessionId).toBe(activeSessionId);
    });
  });

  describe("getStructureCrossLinks", () => {
    it("returns UNION of all 3 link types", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();
      const subsystemId = crypto.randomUUID();
      const sideSystemId = crypto.randomUUID();
      const layerId = crypto.randomUUID();

      await db
        .insert(subsystems)
        .values({
          id: subsystemId,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        });
      await db
        .insert(sideSystems)
        .values({
          id: sideSystemId,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        });
      await db
        .insert(layers)
        .values({
          id: layerId,
          systemId,
          sortOrder: 0,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        });

      await db
        .insert(subsystemLayerLinks)
        .values({ id: crypto.randomUUID(), subsystemId, layerId, systemId, createdAt: now });
      await db
        .insert(subsystemSideSystemLinks)
        .values({ id: crypto.randomUUID(), subsystemId, sideSystemId, systemId, createdAt: now });
      await db
        .insert(sideSystemLayerLinks)
        .values({ id: crypto.randomUUID(), sideSystemId, layerId, systemId, createdAt: now });

      const links = await getStructureCrossLinks(db, systemId);
      expect(links).toHaveLength(3);
      const types = links.map((l) => l.linkType).sort();
      expect(types).toEqual(["side-system-layer", "subsystem-layer", "subsystem-side-system"]);
    });
  });
});
