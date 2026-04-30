/**
 * SQLite fronting schema — fronting_sessions core constraints.
 *
 * Covers: fronting_sessions — basic lifecycle, time CHECKs, T3 metadata,
 *   member/customFront FK constraints = 14 tests.
 *
 * Companion: schema-sqlite-fronting-sessions-archival.integration.test.ts (tests 15–22)
 * Source: schema-sqlite-fronting.integration.test.ts (lines 103–495)
 */

import { brandId, toUnixMillis } from "@pluralscape/types";
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

describe("SQLite fronting schema — fronting_sessions core", () => {
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
      .values({ id, systemId: brandId<SystemId>(systemId), encryptedData: testBlob(), createdAt: now, updatedAt: now })
      .run();
    return id;
  }

  function insertFrontingSession(systemId: SystemId, id = crypto.randomUUID(), memberId?: MemberId): FrontingSessionId {
    const sessionId = brandId<FrontingSessionId>(id);
    const now = fixtureNow();
    const resolvedMemberId = memberId ?? insertMember(systemId);
    db.insert(frontingSessions)
      .values({ id: sessionId, systemId, startTime: now, memberId: resolvedMemberId, encryptedData: testBlob(), createdAt: now, updatedAt: now })
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

  describe("fronting_sessions", () => {
    it("inserts with encrypted_data and round-trips binary", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(frontingSessions)
        .values({ id, systemId, memberId, startTime: now, endTime: toUnixMillis(now + 1000), encryptedData: data, createdAt: now, updatedAt: now })
        .run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.startTime).toBe(now);
      expect(rows[0]?.endTime).toBe(now + 1000);
    });

    it("allows nullable endTime for open sessions", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(frontingSessions)
        .values({ id, systemId, memberId, startTime: now, encryptedData: testBlob(new Uint8Array([1])), createdAt: now, updatedAt: now })
        .run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.endTime).toBeNull();
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertFrontingSession(systemId);
      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sessionId = insertFrontingSession(systemId);

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, sessionId)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", () => {
      const now = fixtureNow();
      expect(() =>
        db
          .insert(frontingSessions)
          .values({
            id: brandId<FrontingSessionId>(crypto.randomUUID()),
            systemId: brandId<SystemId>("nonexistent"),
            memberId: brandId<MemberId>("nonexistent-member"),
            startTime: now,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects endTime less than or equal to startTime via CHECK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = fixtureNow();

      expect(() =>
        db.insert(frontingSessions).values({ id: brandId<FrontingSessionId>(crypto.randomUUID()), systemId, memberId, startTime: now, endTime: now, encryptedData: testBlob(new Uint8Array([1])), createdAt: now, updatedAt: now }).run(),
      ).toThrow(/CHECK|constraint/i);

      expect(() =>
        db.insert(frontingSessions).values({ id: brandId<FrontingSessionId>(crypto.randomUUID()), systemId, memberId, startTime: now, endTime: toUnixMillis(now - 1), encryptedData: testBlob(new Uint8Array([1])), createdAt: now, updatedAt: now }).run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("allows overlapping sessions for the same system", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId1 = insertMember(systemId);
      const memberId2 = insertMember(systemId);
      const now = fixtureNow();

      db.insert(frontingSessions).values({ id: brandId<FrontingSessionId>(crypto.randomUUID()), systemId, memberId: memberId1, startTime: now, endTime: toUnixMillis(now + 2000), encryptedData: testBlob(new Uint8Array([1])), createdAt: now, updatedAt: now }).run();
      db.insert(frontingSessions).values({ id: brandId<FrontingSessionId>(crypto.randomUUID()), systemId, memberId: memberId2, startTime: toUnixMillis(now + 1000), endTime: toUnixMillis(now + 3000), encryptedData: testBlob(new Uint8Array([2])), createdAt: now, updatedAt: now }).run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.systemId, systemId)).all();
      expect(rows).toHaveLength(2);
    });

    it("round-trips T3 metadata columns", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const cfId = insertCustomFront(systemId);
      const now = fixtureNow();
      const entityTypeId = crypto.randomUUID();
      const entityId = brandId<SystemStructureEntityId>(crypto.randomUUID());

      client.exec(`INSERT INTO system_structure_entity_types (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived) VALUES ('${entityTypeId}', '${systemId}', 0, X'0102', ${String(now)}, ${String(now)}, 1, 0)`);
      client.exec(`INSERT INTO system_structure_entities (id, system_id, entity_type_id, sort_order, encrypted_data, created_at, updated_at, version, archived) VALUES ('${entityId}', '${systemId}', '${entityTypeId}', 0, X'0102', ${String(now)}, ${String(now)}, 1, 0)`);

      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      db.insert(frontingSessions).values({ id, systemId, startTime: now, encryptedData: testBlob(new Uint8Array([1])), createdAt: now, updatedAt: now, memberId, customFrontId: cfId, structureEntityId: entityId }).run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.memberId).toBe(memberId);
      expect(rows[0]?.customFrontId).toBe(cfId);
      expect(rows[0]?.structureEntityId).toBe(entityId);
    });

    it("defaults T3 metadata columns to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const customFrontId = insertCustomFront(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(frontingSessions).values({ id, systemId, customFrontId, startTime: now, encryptedData: testBlob(new Uint8Array([1])), createdAt: now, updatedAt: now }).run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.structureEntityId).toBeNull();
    });

    it("restricts member deletion when referenced by fronting session", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = fixtureNow();

      db.insert(frontingSessions).values({ id: brandId<FrontingSessionId>(crypto.randomUUID()), systemId, startTime: now, memberId, encryptedData: testBlob(new Uint8Array([1])), createdAt: now, updatedAt: now }).run();

      expect(() => db.delete(members).where(eq(members.id, memberId)).run()).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects nonexistent memberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db.insert(frontingSessions).values({ id: brandId<FrontingSessionId>(crypto.randomUUID()), systemId, startTime: now, memberId: brandId<MemberId>("nonexistent"), encryptedData: testBlob(new Uint8Array([1])), createdAt: now, updatedAt: now }).run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("restricts custom front deletion when referenced by fronting session", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const customFrontId = insertCustomFront(systemId);
      const now = fixtureNow();

      db.insert(frontingSessions).values({ id: brandId<FrontingSessionId>(crypto.randomUUID()), systemId, startTime: now, customFrontId, encryptedData: testBlob(new Uint8Array([1])), createdAt: now, updatedAt: now }).run();

      expect(() => db.delete(customFronts).where(eq(customFronts.id, customFrontId)).run()).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects nonexistent customFrontId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db.insert(frontingSessions).values({ id: brandId<FrontingSessionId>(crypto.randomUUID()), systemId, startTime: now, customFrontId: brandId<CustomFrontId>("nonexistent"), encryptedData: testBlob(new Uint8Array([1])), createdAt: now, updatedAt: now }).run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("accepts fronting session with only customFrontId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const customFrontId = insertCustomFront(systemId);
      const id = brandId<FrontingSessionId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(frontingSessions).values({ id, systemId, startTime: now, customFrontId, encryptedData: testBlob(new Uint8Array([1])), createdAt: now, updatedAt: now }).run();

      const rows = db.select().from(frontingSessions).where(eq(frontingSessions.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.memberId).toBeNull();
      expect(rows[0]?.customFrontId).toBe(customFrontId);
    });
  });
});
