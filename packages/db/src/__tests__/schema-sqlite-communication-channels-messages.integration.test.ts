/**
 * SQLite communication schema — channels and messages tables.
 *
 * Covers: channels (9 tests), messages (7 tests) = 16 tests.
 *
 * Source: schema-sqlite-communication.integration.test.ts (lines 90-582)
 * Companion file: schema-sqlite-communication-board-messages.integration.test.ts
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { channels, messages } from "../schema/sqlite/communication.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteCommunicationTables,
  sqliteInsertAccount,
  sqliteInsertChannel,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { ChannelId, MessageId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, channels, messages };

describe("SQLite communication schema — channels and messages", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);
  const insertChannel = (systemId: string, opts?: Parameters<typeof sqliteInsertChannel>[2]) =>
    sqliteInsertChannel(db, systemId, opts);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteCommunicationTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(messages).run();
    db.delete(channels).run();
  });

  describe("channels", () => {
    it("round-trips with encrypted_data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const data = testBlob(new Uint8Array([10, 20, 30]));
      const id = brandId<ChannelId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(channels)
        .values({
          id,
          systemId,
          type: "channel",
          sortOrder: 0,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(channels).where(eq(channels.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.type).toBe("channel");
    });

    it("rejects invalid type via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(channels)
          .values({
            id: brandId<ChannelId>(crypto.randomUUID()),
            systemId,
            type: "invalid" as "channel",
            sortOrder: 0,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects negative sort_order via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(channels)
          .values({
            id: brandId<ChannelId>(crypto.randomUUID()),
            systemId,
            type: "channel",
            sortOrder: -1,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("self-ref FK sets parentId to null on parent delete", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const parentId = insertChannel(systemId, { type: "category" });
      const childId = insertChannel(systemId, { parentId });

      db.delete(channels).where(eq(channels.id, parentId)).run();
      const rows = db.select().from(channels).where(eq(channels.id, childId)).all();
      expect(rows[0]?.parentId).toBeNull();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(channels).where(eq(channels.id, channelId)).all();
      expect(rows).toHaveLength(0);
    });

    it("defaults archived to false and version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);

      const rows = db.select().from(channels).where(eq(channels.id, channelId)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO channels (id, system_id, type, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 'channel', 0, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO channels (id, system_id, type, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 'channel', 0, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const now = fixtureNow();

      db.update(channels)
        .set({ archived: true, archivedAt: now })
        .where(eq(channels.id, channelId))
        .run();

      const rows = db.select().from(channels).where(eq(channels.id, channelId)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("messages", () => {
    it("round-trips with all fields", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const id = brandId<MessageId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([5, 6, 7]));

      db.insert(messages)
        .values({
          id,
          channelId,
          systemId,
          timestamp: now,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(messages).where(eq(messages.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("cascades on channel deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const msgId = brandId<MessageId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(messages)
        .values({
          id: msgId,
          channelId,
          systemId,
          timestamp: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(channels).where(eq(channels.id, channelId)).run();
      const rows = db.select().from(messages).where(eq(messages.id, msgId)).all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const msgId = brandId<MessageId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(messages)
        .values({
          id: msgId,
          channelId,
          systemId,
          timestamp: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(messages).where(eq(messages.id, msgId)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO messages (id, channel_id, system_id, timestamp, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, ?, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), channelId, systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO messages (id, channel_id, system_id, timestamp, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, ?, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), channelId, systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const id = brandId<MessageId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(messages)
        .values({
          id,
          channelId,
          systemId,
          timestamp: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(messages).set({ archived: true, archivedAt: now }).where(eq(messages.id, id)).run();

      const rows = db.select().from(messages).where(eq(messages.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("allows replyToId referencing nonexistent message (no self-FK)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const channelId = insertChannel(systemId);
      const id = brandId<MessageId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(messages)
        .values({
          id,
          channelId,
          systemId,
          timestamp: now,
          replyToId: brandId<MessageId>("nonexistent-message-id"),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(messages).where(eq(messages.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.replyToId).toBe("nonexistent-message-id");
    });
  });
});
