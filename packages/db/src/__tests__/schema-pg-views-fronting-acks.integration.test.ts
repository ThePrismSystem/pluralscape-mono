import { brandId, toUnixMillis } from "@pluralscape/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { apiKeys } from "../schema/pg/api-keys.js";
import { acknowledgements } from "../schema/pg/communication.js";
import { frontingSessions } from "../schema/pg/fronting.js";
import { friendConnections } from "../schema/pg/privacy.js";
import { webhookConfigs, webhookDeliveries } from "../schema/pg/webhooks.js";
import {
  getActiveApiKeys,
  getCurrentFronters,
  getCurrentFrontersWithDuration,
  getPendingFriendRequests,
  getPendingWebhookRetries,
  getUnconfirmedAcknowledgements,
} from "../views/pg.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { pgInsertAccount, pgInsertSystem, testBlob } from "./helpers/pg-helpers.js";
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
  AcknowledgementId,
  ApiKeyId,
  FriendConnectionId,
  FrontingSessionId,
  MemberId,
  ServerSecret,
  SystemId,
  T3EncryptedBytes,
  WebhookDeliveryId,
  WebhookId,
} from "@pluralscape/types";

describe("PG views — fronting, api keys, friends, webhooks, acks", () => {
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

  describe("getCurrentFronters", () => {
    it("returns sessions with null end_time", async () => {
      const now = fixtureNow();

      await db.insert(frontingSessions).values({
        id: brandId<FrontingSessionId>(crypto.randomUUID()),
        systemId,
        memberId,
        startTime: toUnixMillis(now - 60000),
        endTime: null,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(frontingSessions).values({
        id: brandId<FrontingSessionId>(crypto.randomUUID()),
        systemId,
        memberId,
        startTime: toUnixMillis(now - 120000),
        endTime: toUnixMillis(now - 30000),
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
      const now = fixtureNow();

      await db.insert(frontingSessions).values({
        id: brandId<FrontingSessionId>(crypto.randomUUID()),
        systemId,
        memberId,
        startTime: toUnixMillis(now - 60000),
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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();

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
      const now = fixtureNow();
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
        nextRetryAt: toUnixMillis(now - 60000),
        encryptedData: new Uint8Array([1, 2, 3]) as T3EncryptedBytes,
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
        nextRetryAt: toUnixMillis(now - 60000),
        encryptedData: new Uint8Array([1, 2, 3]) as T3EncryptedBytes,
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
        nextRetryAt: toUnixMillis(now + 60000),
        encryptedData: new Uint8Array([1, 2, 3]) as T3EncryptedBytes,
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
      const now = fixtureNow();

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
});
