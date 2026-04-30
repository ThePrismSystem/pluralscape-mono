import { brandId, toUnixMillis } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { channels, messages } from "../schema/pg/communication.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearCommunicationTables,
  insertAccount as insertAccountWith,
  insertChannel as insertChannelWith,
  insertSystem as insertSystemWith,
  setupCommunicationFixture,
  teardownCommunicationFixture,
  type CommunicationDb,
} from "./helpers/communication-fixtures.js";
import { testBlob } from "./helpers/pg-helpers.js";

import type { PGlite } from "@electric-sql/pglite";
import type { ChannelId, MessageId } from "@pluralscape/types";

describe("PG communication schema — channels and messages", () => {
  let client: PGlite;
  let db: CommunicationDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);
  const insertChannel = (
    systemId: string,
    opts?: Parameters<typeof insertChannelWith>[2],
  ): ReturnType<typeof insertChannelWith> => insertChannelWith(db, systemId, opts);

  beforeAll(async () => {
    const fixture = await setupCommunicationFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownCommunicationFixture({ client, db });
  });

  afterEach(async () => {
    await clearCommunicationTables(db);
  });

  describe("channels", () => {
    it("round-trips with encrypted_data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const data = testBlob(new Uint8Array([10, 20, 30]));
      const id = brandId<ChannelId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(channels).values({
        id,
        systemId,
        type: "channel",
        sortOrder: 0,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(channels).where(eq(channels.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.type).toBe("channel");
      expect(rows[0]?.sortOrder).toBe(0);
    });

    it("rejects invalid type via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(channels).values({
          id: brandId<ChannelId>(crypto.randomUUID()),
          systemId,
          type: "invalid" as "channel",
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects negative sort_order via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(channels).values({
          id: brandId<ChannelId>(crypto.randomUUID()),
          systemId,
          type: "channel",
          sortOrder: -1,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("restricts parent channel deletion when referenced by child channel", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const parentId = await insertChannel(systemId, { type: "category" });
      await insertChannel(systemId, { parentId });

      await expect(db.delete(channels).where(eq(channels.id, parentId))).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(channels).where(eq(channels.id, channelId));
      expect(rows).toHaveLength(0);
    });

    it("defaults archived to false and version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);

      const rows = await db.select().from(channels).where(eq(channels.id, channelId));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("round-trips archived state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<ChannelId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(channels).values({
        id,
        systemId,
        type: "channel",
        sortOrder: 0,
        archived: true,
        archivedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(channels).where(eq(channels.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);

      const archiveTime = fixtureNow();
      await db
        .update(channels)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(channels.id, channelId));

      const rows = await db.select().from(channels).where(eq(channels.id, channelId));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO channels (id, system_id, type, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 'channel', 0, '\\x0102'::bytea, $3, $4, 1, true, NULL)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO channels (id, system_id, type, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 'channel', 0, '\\x0102'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  describe("messages", () => {
    it("round-trips with all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const id = brandId<MessageId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([5, 6, 7]));

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: now,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(messages).where(eq(messages.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.editedAt).toBeNull();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const id = brandId<MessageId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: now,
        archived: true,
        archivedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(messages).where(eq(messages.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const id = brandId<MessageId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const archiveTime = fixtureNow();
      await db
        .update(messages)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(messages.id, id));

      const rows = await db.select().from(messages).where(eq(messages.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("round-trips editedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const id = brandId<MessageId>(crypto.randomUUID());
      const now = fixtureNow();
      const editedAt = toUnixMillis(now + 1000);

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: now,
        editedAt,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(messages).where(eq(messages.id, id));
      expect(rows[0]?.editedAt).toBe(editedAt);
    });

    it("restricts channel deletion when referenced by message", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();
      const msgId = brandId<MessageId>(crypto.randomUUID());

      await db.insert(messages).values({
        id: msgId,
        channelId,
        systemId,
        timestamp: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(db.delete(channels).where(eq(channels.id, channelId))).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();
      const msgId = brandId<MessageId>(crypto.randomUUID());

      await db.insert(messages).values({
        id: msgId,
        channelId,
        systemId,
        timestamp: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(messages).where(eq(messages.id, msgId));
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO messages (id, channel_id, system_id, timestamp, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, $4, '\\x0102'::bytea, $5, $6, 1, true, NULL)",
          [crypto.randomUUID(), channelId, systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO messages (id, channel_id, system_id, timestamp, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, $3, $4, '\\x0102'::bytea, $5, $6, 1, false, $7)",
          [crypto.randomUUID(), channelId, systemId, now, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("allows replyToId referencing nonexistent message (no self-FK)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();
      const id = brandId<MessageId>(crypto.randomUUID());

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        replyToId: brandId<MessageId>("nonexistent-message-id"),
        timestamp: now,
        encryptedData: testBlob(new Uint8Array([1, 2])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(messages).where(eq(messages.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.replyToId).toBe("nonexistent-message-id");
    });

    it("rejects duplicate (id, timestamp) pair", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();
      const id = brandId<MessageId>(crypto.randomUUID());

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(messages).values({
          id,
          channelId,
          systemId,
          timestamp: now,
          encryptedData: testBlob(new Uint8Array([2])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows same id with different timestamp", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const channelId = await insertChannel(systemId);
      const now = fixtureNow();
      const id = brandId<MessageId>(crypto.randomUUID());

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: now,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(messages).values({
        id,
        channelId,
        systemId,
        timestamp: toUnixMillis(now + 1000),
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(messages).where(eq(messages.id, id));
      expect(rows).toHaveLength(2);
    });
  });
});
