import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { members } from "../schema/sqlite/members.js";
import {
  layers,
  layerMemberships,
  relationships,
  sideSystems,
  sideSystemLayerLinks,
  sideSystemMemberships,
  subsystems,
  subsystemLayerLinks,
  subsystemMemberships,
  subsystemSideSystemLinks,
} from "../schema/sqlite/structure.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteStructureTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = {
  accounts,
  systems,
  members,
  relationships,
  subsystems,
  sideSystems,
  layers,
  subsystemMemberships,
  sideSystemMemberships,
  layerMemberships,
  subsystemLayerLinks,
  subsystemSideSystemLinks,
  sideSystemLayerLinks,
};

describe("SQLite structure schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertMember = (systemId: string, id?: string): string =>
    sqliteInsertMember(db, systemId, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

  function insertSubsystem(
    systemId: string,
    parentSubsystemId: string | null = null,
    id = crypto.randomUUID(),
  ): string {
    const now = Date.now();
    db.insert(subsystems)
      .values({
        id,
        systemId,
        parentSubsystemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  function insertSideSystem(systemId: string, id = crypto.randomUUID()): string {
    const now = Date.now();
    db.insert(sideSystems)
      .values({
        id,
        systemId,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  function insertLayer(systemId: string, sortOrder: number, id = crypto.randomUUID()): string {
    const now = Date.now();
    db.insert(layers)
      .values({
        id,
        systemId,
        sortOrder,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteStructureTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(subsystemLayerLinks).run();
    db.delete(subsystemSideSystemLinks).run();
    db.delete(sideSystemLayerLinks).run();
    db.delete(subsystemMemberships).run();
    db.delete(sideSystemMemberships).run();
    db.delete(layerMemberships).run();
    db.delete(relationships).run();
    db.delete(subsystems).run();
    db.delete(sideSystems).run();
    db.delete(layers).run();
  });

  describe("relationships", () => {
    it("inserts and round-trips encrypted data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", () => {
      const now = Date.now();
      expect(() =>
        db
          .insert(relationships)
          .values({
            id: crypto.randomUUID(),
            systemId: "nonexistent",
            type: "sibling",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("round-trips T3 metadata columns", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sourceMemberId = insertMember(systemId);
      const targetMemberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          sourceMemberId,
          targetMemberId,
          type: "sibling",
          bidirectional: true,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.sourceMemberId).toBe(sourceMemberId);
      expect(rows[0]?.targetMemberId).toBe(targetMemberId);
      expect(rows[0]?.type).toBe("sibling");
      expect(rows[0]?.bidirectional).toBe(true);
    });

    it("defaults T3 metadata to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.sourceMemberId).toBeNull();
      expect(rows[0]?.targetMemberId).toBeNull();
      expect(rows[0]?.bidirectional).toBe(false);
    });

    it("rejects invalid type via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(relationships)
          .values({
            id: crypto.randomUUID(),
            systemId,
            type: "invalid" as "sibling",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("sets sourceMemberId to null on member deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          sourceMemberId: memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(members).where(eq(members.id, memberId)).run();
      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.sourceMemberId).toBeNull();
    });

    it("rejects nonexistent sourceMemberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(relationships)
          .values({
            id: crypto.randomUUID(),
            systemId,
            type: "sibling",
            sourceMemberId: "nonexistent",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("sets targetMemberId to null on member deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          targetMemberId: memberId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(members).where(eq(members.id, memberId)).run();
      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.targetMemberId).toBeNull();
    });

    it("rejects nonexistent targetMemberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(relationships)
          .values({
            id: crypto.randomUUID(),
            systemId,
            type: "sibling",
            targetMemberId: "nonexistent",
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
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO relationships (id, system_id, type, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, 'sibling', X'0102', ?, ?, 1, NULL)`,
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO relationships (id, system_id, type, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, 'sibling', X'0102', ?, ?, 0, ?)`,
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(relationships)
        .values({
          id,
          systemId,
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(relationships)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(relationships.id, id))
        .run();

      const rows = db.select().from(relationships).where(eq(relationships.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("subsystems", () => {
    it("inserts and round-trips encrypted data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30]));

      db.insert(subsystems)
        .values({
          id,
          systemId,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(subsystems).where(eq(subsystems.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("allows nullable parentSubsystemId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(subsystems)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(subsystems).where(eq(subsystems.id, id)).all();
      expect(rows[0]?.parentSubsystemId).toBeNull();
    });

    it("sets parentSubsystemId to NULL on parent delete", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const parentId = insertSubsystem(systemId);
      const childId = insertSubsystem(systemId, parentId);

      db.delete(subsystems).where(eq(subsystems.id, parentId)).run();

      const rows = db.select().from(subsystems).where(eq(subsystems.id, childId)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.parentSubsystemId).toBeNull();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(subsystems).where(eq(subsystems.id, subsystemId)).all();
      expect(rows).toHaveLength(0);
    });

    it("round-trips T3 metadata columns", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(subsystems)
        .values({
          id,
          systemId,
          architectureType: { kind: "known", type: "orbital" },
          hasCore: true,
          discoveryStatus: "fully-mapped",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(subsystems).where(eq(subsystems.id, id)).all();
      expect(rows[0]?.architectureType).toEqual({ kind: "known", type: "orbital" });
      expect(rows[0]?.hasCore).toBe(true);
      expect(rows[0]?.discoveryStatus).toBe("fully-mapped");
    });

    it("defaults T3 metadata to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(subsystems)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(subsystems).where(eq(subsystems.id, id)).all();
      expect(rows[0]?.architectureType).toBeNull();
      expect(rows[0]?.hasCore).toBe(false);
      expect(rows[0]?.discoveryStatus).toBeNull();
    });

    it("rejects invalid discoveryStatus via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(subsystems)
          .values({
            id: crypto.randomUUID(),
            systemId,
            discoveryStatus: "invalid" as "fully-mapped",
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(subsystems)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(subsystems).where(eq(subsystems.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(subsystems)
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

      const rows = db.select().from(subsystems).where(eq(subsystems.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO subsystems (id, system_id, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, X'0102', ?, ?, 1, NULL)`,
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO subsystems (id, system_id, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, X'0102', ?, ?, 0, ?)`,
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertSubsystem(systemId);
      const now = Date.now();

      db.update(subsystems)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(subsystems.id, id))
        .run();

      const rows = db.select().from(subsystems).where(eq(subsystems.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("side_systems", () => {
    it("inserts and round-trips encrypted data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([5, 10, 15]));

      db.insert(sideSystems)
        .values({
          id,
          systemId,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(sideSystems).where(eq(sideSystems.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(sideSystems)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(sideSystems).where(eq(sideSystems.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sideSystemId = insertSideSystem(systemId);

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(sideSystems).where(eq(sideSystems.id, sideSystemId)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", () => {
      const now = Date.now();
      expect(() =>
        db
          .insert(sideSystems)
          .values({
            id: crypto.randomUUID(),
            systemId: "nonexistent",
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
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(sideSystems)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(sideSystems).where(eq(sideSystems.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(sideSystems)
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

      const rows = db.select().from(sideSystems).where(eq(sideSystems.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO side_systems (id, system_id, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, X'0102', ?, ?, 1, NULL)`,
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO side_systems (id, system_id, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, X'0102', ?, ?, 0, ?)`,
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertSideSystem(systemId);
      const now = Date.now();

      db.update(sideSystems)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(sideSystems.id, id))
        .run();

      const rows = db.select().from(sideSystems).where(eq(sideSystems.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("layers", () => {
    it("inserts with sortOrder and round-trips encrypted data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([7, 14, 21]));

      db.insert(layers)
        .values({
          id,
          systemId,
          sortOrder: 3,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(layers).where(eq(layers.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.sortOrder).toBe(3);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(layers)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(layers).where(eq(layers.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const layerId = insertLayer(systemId, 1);

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(layers).where(eq(layers.id, layerId)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", () => {
      const now = Date.now();
      expect(() =>
        db
          .insert(layers)
          .values({
            id: crypto.randomUUID(),
            systemId: "nonexistent",
            sortOrder: 0,
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
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(layers)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(layers).where(eq(layers.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(layers)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(layers).where(eq(layers.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO layers (id, system_id, sort_order, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, 0, X'0102', ?, ?, 1, NULL)`,
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO layers (id, system_id, sort_order, encrypted_data, created_at, updated_at, archived, archived_at)
             VALUES (?, ?, 0, X'0102', ?, ?, 0, ?)`,
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = insertLayer(systemId, 0);
      const now = Date.now();

      db.update(layers)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(layers.id, id))
        .run();

      const rows = db.select().from(layers).where(eq(layers.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });

  describe("subsystem_memberships", () => {
    it("inserts and round-trips data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([11, 22, 33]));

      db.insert(subsystemMemberships)
        .values({
          id,
          subsystemId,
          systemId,
          encryptedData: data,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(subsystemMemberships)
        .where(eq(subsystemMemberships.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.subsystemId).toBe(subsystemId);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("cascades on subsystem deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(subsystemMemberships)
        .values({
          id,
          subsystemId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
        })
        .run();

      db.delete(subsystems).where(eq(subsystems.id, subsystemId)).run();
      const rows = db
        .select()
        .from(subsystemMemberships)
        .where(eq(subsystemMemberships.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(subsystemMemberships)
        .values({
          id,
          subsystemId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db
        .select()
        .from(subsystemMemberships)
        .where(eq(subsystemMemberships.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent subsystemId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(subsystemMemberships)
          .values({
            id: crypto.randomUUID(),
            subsystemId: "nonexistent",
            systemId,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });

  describe("side_system_memberships", () => {
    it("inserts and round-trips data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sideSystemId = insertSideSystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([44, 55, 66]));

      db.insert(sideSystemMemberships)
        .values({
          id,
          sideSystemId,
          systemId,
          encryptedData: data,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(sideSystemMemberships)
        .where(eq(sideSystemMemberships.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.sideSystemId).toBe(sideSystemId);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("cascades on side system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sideSystemId = insertSideSystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(sideSystemMemberships)
        .values({
          id,
          sideSystemId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
        })
        .run();

      db.delete(sideSystems).where(eq(sideSystems.id, sideSystemId)).run();
      const rows = db
        .select()
        .from(sideSystemMemberships)
        .where(eq(sideSystemMemberships.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sideSystemId = insertSideSystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(sideSystemMemberships)
        .values({
          id,
          sideSystemId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db
        .select()
        .from(sideSystemMemberships)
        .where(eq(sideSystemMemberships.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });
  });

  describe("layer_memberships", () => {
    it("inserts and round-trips data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const layerId = insertLayer(systemId, 1);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([77, 88, 99]));

      db.insert(layerMemberships)
        .values({
          id,
          layerId,
          systemId,
          encryptedData: data,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(layerMemberships).where(eq(layerMemberships.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.layerId).toBe(layerId);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("cascades on layer deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const layerId = insertLayer(systemId, 1);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(layerMemberships)
        .values({
          id,
          layerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
        })
        .run();

      db.delete(layers).where(eq(layers.id, layerId)).run();
      const rows = db.select().from(layerMemberships).where(eq(layerMemberships.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const layerId = insertLayer(systemId, 1);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(layerMemberships)
        .values({
          id,
          layerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(layerMemberships).where(eq(layerMemberships.id, id)).all();
      expect(rows).toHaveLength(0);
    });
  });

  describe("subsystem_layer_links", () => {
    it("inserts and round-trips data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const layerId = insertLayer(systemId, 1);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([100, 110]));

      db.insert(subsystemLayerLinks)
        .values({
          id,
          subsystemId,
          layerId,
          systemId,
          encryptedData: data,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(subsystemLayerLinks)
        .where(eq(subsystemLayerLinks.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.subsystemId).toBe(subsystemId);
      expect(rows[0]?.layerId).toBe(layerId);
    });

    it("allows nullable encryptedData", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const layerId = insertLayer(systemId, 2);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(subsystemLayerLinks)
        .values({
          id,
          subsystemId,
          layerId,
          systemId,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(subsystemLayerLinks)
        .where(eq(subsystemLayerLinks.id, id))
        .all();
      expect(rows[0]?.encryptedData).toBeNull();
    });

    it("rejects duplicate subsystemId + layerId pair", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const layerId = insertLayer(systemId, 1);
      const now = Date.now();

      db.insert(subsystemLayerLinks)
        .values({
          id: crypto.randomUUID(),
          subsystemId,
          layerId,
          systemId,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(subsystemLayerLinks)
          .values({
            id: crypto.randomUUID(),
            subsystemId,
            layerId,
            systemId,
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("cascades on subsystem deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const layerId = insertLayer(systemId, 1);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(subsystemLayerLinks)
        .values({
          id,
          subsystemId,
          layerId,
          systemId,
          createdAt: now,
        })
        .run();

      db.delete(subsystems).where(eq(subsystems.id, subsystemId)).run();
      const rows = db
        .select()
        .from(subsystemLayerLinks)
        .where(eq(subsystemLayerLinks.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on layer deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const layerId = insertLayer(systemId, 1);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(subsystemLayerLinks)
        .values({
          id,
          subsystemId,
          layerId,
          systemId,
          createdAt: now,
        })
        .run();

      db.delete(layers).where(eq(layers.id, layerId)).run();
      const rows = db
        .select()
        .from(subsystemLayerLinks)
        .where(eq(subsystemLayerLinks.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent subsystemId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const layerId = insertLayer(systemId, 1);
      const now = Date.now();

      expect(() =>
        db
          .insert(subsystemLayerLinks)
          .values({
            id: crypto.randomUUID(),
            subsystemId: "nonexistent",
            layerId,
            systemId,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects nonexistent layerId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const now = Date.now();

      expect(() =>
        db
          .insert(subsystemLayerLinks)
          .values({
            id: crypto.randomUUID(),
            subsystemId,
            layerId: "nonexistent",
            systemId,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });

  describe("subsystem_side_system_links", () => {
    it("inserts and round-trips data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const sideSystemId = insertSideSystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([120, 130]));

      db.insert(subsystemSideSystemLinks)
        .values({
          id,
          subsystemId,
          sideSystemId,
          systemId,
          encryptedData: data,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(subsystemSideSystemLinks)
        .where(eq(subsystemSideSystemLinks.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.subsystemId).toBe(subsystemId);
      expect(rows[0]?.sideSystemId).toBe(sideSystemId);
    });

    it("rejects duplicate subsystemId + sideSystemId pair", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const sideSystemId = insertSideSystem(systemId);
      const now = Date.now();

      db.insert(subsystemSideSystemLinks)
        .values({
          id: crypto.randomUUID(),
          subsystemId,
          sideSystemId,
          systemId,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(subsystemSideSystemLinks)
          .values({
            id: crypto.randomUUID(),
            subsystemId,
            sideSystemId,
            systemId,
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("cascades on subsystem deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const sideSystemId = insertSideSystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(subsystemSideSystemLinks)
        .values({
          id,
          subsystemId,
          sideSystemId,
          systemId,
          createdAt: now,
        })
        .run();

      db.delete(subsystems).where(eq(subsystems.id, subsystemId)).run();
      const rows = db
        .select()
        .from(subsystemSideSystemLinks)
        .where(eq(subsystemSideSystemLinks.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on side system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const sideSystemId = insertSideSystem(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(subsystemSideSystemLinks)
        .values({
          id,
          subsystemId,
          sideSystemId,
          systemId,
          createdAt: now,
        })
        .run();

      db.delete(sideSystems).where(eq(sideSystems.id, sideSystemId)).run();
      const rows = db
        .select()
        .from(subsystemSideSystemLinks)
        .where(eq(subsystemSideSystemLinks.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent subsystemId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sideSystemId = insertSideSystem(systemId);
      const now = Date.now();

      expect(() =>
        db
          .insert(subsystemSideSystemLinks)
          .values({
            id: crypto.randomUUID(),
            subsystemId: "nonexistent",
            sideSystemId,
            systemId,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects nonexistent sideSystemId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const subsystemId = insertSubsystem(systemId);
      const now = Date.now();

      expect(() =>
        db
          .insert(subsystemSideSystemLinks)
          .values({
            id: crypto.randomUUID(),
            subsystemId,
            sideSystemId: "nonexistent",
            systemId,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });

  describe("side_system_layer_links", () => {
    it("inserts and round-trips data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sideSystemId = insertSideSystem(systemId);
      const layerId = insertLayer(systemId, 1);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([140, 150]));

      db.insert(sideSystemLayerLinks)
        .values({
          id,
          sideSystemId,
          layerId,
          systemId,
          encryptedData: data,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(sideSystemLayerLinks)
        .where(eq(sideSystemLayerLinks.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.sideSystemId).toBe(sideSystemId);
      expect(rows[0]?.layerId).toBe(layerId);
    });

    it("rejects duplicate sideSystemId + layerId pair", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sideSystemId = insertSideSystem(systemId);
      const layerId = insertLayer(systemId, 1);
      const now = Date.now();

      db.insert(sideSystemLayerLinks)
        .values({
          id: crypto.randomUUID(),
          sideSystemId,
          layerId,
          systemId,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(sideSystemLayerLinks)
          .values({
            id: crypto.randomUUID(),
            sideSystemId,
            layerId,
            systemId,
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("cascades on side system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sideSystemId = insertSideSystem(systemId);
      const layerId = insertLayer(systemId, 1);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(sideSystemLayerLinks)
        .values({
          id,
          sideSystemId,
          layerId,
          systemId,
          createdAt: now,
        })
        .run();

      db.delete(sideSystems).where(eq(sideSystems.id, sideSystemId)).run();
      const rows = db
        .select()
        .from(sideSystemLayerLinks)
        .where(eq(sideSystemLayerLinks.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on layer deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sideSystemId = insertSideSystem(systemId);
      const layerId = insertLayer(systemId, 1);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(sideSystemLayerLinks)
        .values({
          id,
          sideSystemId,
          layerId,
          systemId,
          createdAt: now,
        })
        .run();

      db.delete(layers).where(eq(layers.id, layerId)).run();
      const rows = db
        .select()
        .from(sideSystemLayerLinks)
        .where(eq(sideSystemLayerLinks.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent sideSystemId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const layerId = insertLayer(systemId, 1);
      const now = Date.now();

      expect(() =>
        db
          .insert(sideSystemLayerLinks)
          .values({
            id: crypto.randomUUID(),
            sideSystemId: "nonexistent",
            layerId,
            systemId,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects nonexistent layerId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const sideSystemId = insertSideSystem(systemId);
      const now = Date.now();

      expect(() =>
        db
          .insert(sideSystemLayerLinks)
          .values({
            id: crypto.randomUUID(),
            sideSystemId,
            layerId: "nonexistent",
            systemId,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });
});
