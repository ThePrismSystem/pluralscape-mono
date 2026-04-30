/**
 * SQLite fronting schema — fronting_sessions archival and structureEntityId tests,
 * plus the custom_fronts table.
 *
 * Covers: fronting_sessions (archived state + structureEntityId, tests 15-22 = 8 tests),
 *   custom_fronts (8 tests) = 16 tests total.
 *
 * Source: schema-sqlite-fronting.integration.test.ts (lines 497-821)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { customFronts, frontingSessions } from "../schema/sqlite/fronting.js";
import { members } from "../schema/sqlite/members.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteFrontingTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type {
  CustomFrontId,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, members, frontingSessions, customFronts };

describe("SQLite fronting schema — sessions archival and custom_fronts", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);
  const insertMember = (systemId: SystemId, id?: string): MemberId =>
    sqliteInsertMember(db, systemId, id);

  function insertCustomFront(systemId: string, raw = crypto.randomUUID()): CustomFrontId {
    const id = brandId<CustomFrontId>(raw);
    const now = fixtureNow();
    db.insert(customFronts)
      .values({
        id,
        systemId: brandId<SystemId>(systemId),
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  function insertFrontingSession(
    systemId: SystemId,
    id = crypto.randomUUID(),
    memberId?: MemberId,
  ): FrontingSessionId {
    const sessionId = brandId<FrontingSessionId>(id);
    const now = fixtureNow();
    const resolvedMemberId = memberId ?? insertMember(systemId);
    db.insert(frontingSessions)
      .values({
        id: sessionId,
        systemId,
        startTime: now,
        memberId: resolvedMemberId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return sessionId;
  }

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteFrontingTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(frontingSessions).run();
    db.delete(customFronts).run();
  });

  describe("fronting_sessions — archived state and structureEntityId", () => {
    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertFrontingSession(systemId);

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(frontingSessions)
        .values({
          id,
          systemId,
          startTime: now,
          memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO fronting_sessions (id, system_id, member_id, start_time, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, ?, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, memberId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO fronting_sessions (id, system_id, member_id, start_time, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, ?, ?, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, memberId, now, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertFrontingSession(systemId);
      const now = fixtureNow();

      db.update(frontingSessions)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(frontingSessions.id, id))
        .run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("accepts fronting session with only structureEntityId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();
      const entityTypeId = crypto.randomUUID();
      const entityId = brandId<SystemStructureEntityId>(crypto.randomUUID());

      client
        .prepare(
          "INSERT INTO system_structure_entity_types (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived) VALUES (?, ?, 0, X'0102', ?, ?, 1, 0)",
        )
        .run(entityTypeId, systemId, now, now);
      client
        .prepare(
          "INSERT INTO system_structure_entities (id, system_id, entity_type_id, sort_order, encrypted_data, created_at, updated_at, version, archived) VALUES (?, ?, ?, 0, X'0102', ?, ?, 1, 0)",
        )
        .run(entityId, systemId, entityTypeId, now, now);

      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      db.insert(frontingSessions)
        .values({
          id,
          systemId,
          startTime: now,
          structureEntityId: entityId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.customFrontId).toBeNull();
      expect(rows[0]?.structureEntityId).toBe(entityId);
    });

    it("rejects nonexistent structureEntityId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(frontingSessions)
          .values({
            id: brandId<FrontingSessionId>(crypto.randomUUID()),
            systemId,
            startTime: now,
            structureEntityId: brandId<SystemStructureEntityId>("nonexistent"),
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("restricts deletion of structure entity with dependent fronting session", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();
      const entityTypeId = crypto.randomUUID();
      const entityId = brandId<SystemStructureEntityId>(crypto.randomUUID());

      client
        .prepare(
          "INSERT INTO system_structure_entity_types (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived) VALUES (?, ?, 0, X'0102', ?, ?, 1, 0)",
        )
        .run(entityTypeId, systemId, now, now);
      client
        .prepare(
          "INSERT INTO system_structure_entities (id, system_id, entity_type_id, sort_order, encrypted_data, created_at, updated_at, version, archived) VALUES (?, ?, ?, 0, X'0102', ?, ?, 1, 0)",
        )
        .run(entityId, systemId, entityTypeId, now, now);

      db.insert(frontingSessions)
        .values({
          id: brandId<FrontingSessionId>(crypto.randomUUID()),
          systemId,
          startTime: now,
          structureEntityId: entityId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        client.prepare("DELETE FROM system_structure_entities WHERE id = ?").run(entityId),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });

  // ── custom_fronts ──────────────────────────────────────────────────

  describe("custom_fronts", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<CustomFrontId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(customFronts)
        .values({
          id,
          systemId,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(customFronts).where(eq(customFronts.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults archived to false, archivedAt to null, and version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<CustomFrontId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(customFronts)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(customFronts).where(eq(customFronts.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<CustomFrontId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(customFronts)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(customFronts).where(eq(customFronts.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<CustomFrontId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(customFronts)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(customFronts).where(eq(customFronts.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects version < 1 via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO custom_fronts (id, system_id, encrypted_data, created_at, updated_at, version) VALUES (?, ?, X'0102', ?, ?, 0)",
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO custom_fronts (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'0102', ?, ?, 1, 1, NULL)",
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
            "INSERT INTO custom_fronts (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertCustomFront(systemId);
      const now = fixtureNow();

      db.update(customFronts)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(customFronts.id, id))
        .run();

      const rows = db.select().from(customFronts).where(eq(customFronts.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });
});
