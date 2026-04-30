/**
 * SQLite communication schema — board_messages table.
 *
 * Covers: board_messages (9 tests).
 *
 * Source: schema-sqlite-communication-channels-messages.integration.test.ts (lines 362-551)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { boardMessages } from "../schema/sqlite/communication.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteCommunicationTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BoardMessageId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, boardMessages };

describe("SQLite communication schema — board_messages", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);

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
    db.delete(boardMessages).run();
  });

  describe("board_messages", () => {
    it("round-trips with defaults", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<BoardMessageId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(boardMessages)
        .values({
          id,
          systemId,
          sortOrder: 5,
          encryptedData: testBlob(new Uint8Array([1, 2])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(boardMessages).where(eq(boardMessages.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.pinned).toBe(false);
      expect(rows[0]?.sortOrder).toBe(5);
      expect(rows[0]?.version).toBe(1);
    });

    it("round-trips pinned=true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<BoardMessageId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(boardMessages)
        .values({
          id,
          systemId,
          pinned: true,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(boardMessages).where(eq(boardMessages.id, id)).all();
      expect(rows[0]?.pinned).toBe(true);
    });

    it("rejects negative sort_order via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(boardMessages)
          .values({
            id: brandId<BoardMessageId>(crypto.randomUUID()),
            systemId,
            sortOrder: -1,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<BoardMessageId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(boardMessages)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(boardMessages).where(eq(boardMessages.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<BoardMessageId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(boardMessages)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(boardMessages).where(eq(boardMessages.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<BoardMessageId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(boardMessages)
        .values({
          id,
          systemId,
          sortOrder: 0,
          archived: true,
          archivedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(boardMessages).where(eq(boardMessages.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO board_messages (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 0, X'0102', ?, ?, 1, 1, NULL)",
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
            "INSERT INTO board_messages (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 0, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<BoardMessageId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(boardMessages)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(boardMessages)
        .set({ archived: true, archivedAt: now })
        .where(eq(boardMessages.id, id))
        .run();

      const rows = db.select().from(boardMessages).where(eq(boardMessages.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });
});
