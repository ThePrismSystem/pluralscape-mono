/**
 * SQLite communication schema — acknowledgements table.
 *
 * Covers: acknowledgements (11 tests).
 *
 * Source: schema-sqlite-communication-poll-votes-acknowledgements.integration.test.ts (lines 320-567)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { acknowledgements } from "../schema/sqlite/communication.js";
import { members } from "../schema/sqlite/members.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteCommunicationTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { AcknowledgementId, MemberId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, members, acknowledgements };

describe("SQLite communication schema — acknowledgements", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string) => sqliteInsertMember(db, systemId, id);

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
    db.delete(acknowledgements).run();
  });

  describe("acknowledgements", () => {
    it("round-trips with defaults", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1, 2])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.confirmed).toBe(false);
    });

    it("round-trips confirmed state", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          confirmed: true,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows[0]?.confirmed).toBe(true);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("round-trips createdByMemberId T3 column", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          createdByMemberId: brandId<MemberId>(memberId),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows[0]?.createdByMemberId).toBe(memberId);
    });

    it("defaults createdByMemberId to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows[0]?.createdByMemberId).toBeNull();
    });

    it("sets createdByMemberId to null on member deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          createdByMemberId: brandId<MemberId>(memberId),
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(members).where(eq(members.id, memberId)).run();
      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows[0]?.createdByMemberId).toBeNull();
    });

    it("rejects nonexistent createdByMemberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(acknowledgements)
          .values({
            id: brandId<AcknowledgementId>(crypto.randomUUID()),
            systemId,
            createdByMemberId: brandId<MemberId>("nonexistent"),
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived state", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          archived: true,
          archivedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
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
            "INSERT INTO acknowledgements (id, system_id, encrypted_data, created_at, updated_at, archived, archived_at) VALUES (?, ?, X'0102', ?, ?, 1, NULL)",
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
            "INSERT INTO acknowledgements (id, system_id, encrypted_data, created_at, updated_at, archived, archived_at) VALUES (?, ?, X'0102', ?, ?, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<AcknowledgementId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(acknowledgements)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(acknowledgements)
        .set({ archived: true, archivedAt: now })
        .where(eq(acknowledgements.id, id))
        .run();

      const rows = db.select().from(acknowledgements).where(eq(acknowledgements.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });
});
