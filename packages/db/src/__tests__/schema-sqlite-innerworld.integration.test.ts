import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  innerworldCanvas,
  innerworldEntities,
  innerworldRegions,
} from "../schema/sqlite/innerworld.js";

import {
  createSqliteInnerworldTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type DatabaseConstructor from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

describe("SQLite Innerworld Schema", () => {
  let client: InstanceType<typeof DatabaseConstructor>;
  let db: BetterSQLite3Database<Record<string, unknown>>;

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client);
    createSqliteInnerworldTables(client);
  });

  afterAll(() => {
    client.close();
  });

  function setupSystem(): string {
    const accountId = sqliteInsertAccount(db);
    return sqliteInsertSystem(db, accountId);
  }

  it("round-trips innerworldRegions with all fields", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();

    db.insert(innerworldRegions)
      .values({
        id: regionId,
        systemId,
        parentRegionId: null,
        encryptedData: testBlob(new Uint8Array([10, 20, 30])),
        createdAt: now,
        updatedAt: now,
        version: 1,
      })
      .run();

    const rows = db
      .select()
      .from(innerworldRegions)
      .where(eq(innerworldRegions.id, regionId))
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(regionId);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.parentRegionId).toBeNull();
    expect(rows[0]?.encryptedData).toEqual(testBlob(new Uint8Array([10, 20, 30])));
    expect(rows[0]?.createdAt).toBe(now);
    expect(rows[0]?.updatedAt).toBe(now);
    expect(rows[0]?.version).toBe(1);
    expect(rows[0]).not.toHaveProperty("gatekeeperMemberIds");
  });

  it("innerworld_regions defaults archived to false and archivedAt to null", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();

    db.insert(innerworldRegions)
      .values({
        id: regionId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db
      .select()
      .from(innerworldRegions)
      .where(eq(innerworldRegions.id, regionId))
      .all();
    expect(rows[0]?.archived).toBe(false);
    expect(rows[0]?.archivedAt).toBeNull();
  });

  it("innerworld_regions round-trips archived: true with archivedAt", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();

    db.insert(innerworldRegions)
      .values({
        id: regionId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      })
      .run();

    const rows = db
      .select()
      .from(innerworldRegions)
      .where(eq(innerworldRegions.id, regionId))
      .all();
    expect(rows[0]?.archived).toBe(true);
    expect(rows[0]?.archivedAt).toBe(now);
  });

  it("innerworld_regions rejects archived=true with archivedAt=null via CHECK", () => {
    const systemId = setupSystem();
    const now = Date.now();

    expect(() =>
      client
        .prepare(
          "INSERT INTO innerworld_regions (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'010203', ?, ?, 1, 1, NULL)",
        )
        .run(crypto.randomUUID(), systemId, now, now),
    ).toThrow(/CHECK|constraint/i);
  });

  it("innerworld_regions rejects archived=false with archivedAt set via CHECK", () => {
    const systemId = setupSystem();
    const now = Date.now();

    expect(() =>
      client
        .prepare(
          "INSERT INTO innerworld_regions (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'010203', ?, ?, 1, 0, ?)",
        )
        .run(crypto.randomUUID(), systemId, now, now, now),
    ).toThrow(/CHECK|constraint/i);
  });

  it("round-trips innerworldEntities with all fields", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();

    db.insert(innerworldRegions)
      .values({
        id: regionId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const entityId = crypto.randomUUID();
    db.insert(innerworldEntities)
      .values({
        id: entityId,
        systemId,
        regionId,
        encryptedData: testBlob(new Uint8Array([40, 50, 60])),
        createdAt: now,
        updatedAt: now,
        version: 1,
      })
      .run();

    const rows = db
      .select()
      .from(innerworldEntities)
      .where(eq(innerworldEntities.id, entityId))
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(entityId);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.regionId).toBe(regionId);
    expect(rows[0]?.encryptedData).toEqual(testBlob(new Uint8Array([40, 50, 60])));
  });

  it("innerworld_entities defaults archived to false and archivedAt to null", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const entityId = crypto.randomUUID();

    db.insert(innerworldEntities)
      .values({
        id: entityId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db
      .select()
      .from(innerworldEntities)
      .where(eq(innerworldEntities.id, entityId))
      .all();
    expect(rows[0]?.archived).toBe(false);
    expect(rows[0]?.archivedAt).toBeNull();
  });

  it("innerworld_entities round-trips archived: true with archivedAt", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const entityId = crypto.randomUUID();

    db.insert(innerworldEntities)
      .values({
        id: entityId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      })
      .run();

    const rows = db
      .select()
      .from(innerworldEntities)
      .where(eq(innerworldEntities.id, entityId))
      .all();
    expect(rows[0]?.archived).toBe(true);
    expect(rows[0]?.archivedAt).toBe(now);
  });

  it("innerworld_entities rejects archived=true with archivedAt=null via CHECK", () => {
    const systemId = setupSystem();
    const now = Date.now();

    expect(() =>
      client
        .prepare(
          "INSERT INTO innerworld_entities (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'010203', ?, ?, 1, 1, NULL)",
        )
        .run(crypto.randomUUID(), systemId, now, now),
    ).toThrow(/CHECK|constraint/i);
  });

  it("innerworld_entities rejects archived=false with archivedAt set via CHECK", () => {
    const systemId = setupSystem();
    const now = Date.now();

    expect(() =>
      client
        .prepare(
          "INSERT INTO innerworld_entities (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'010203', ?, ?, 1, 0, ?)",
        )
        .run(crypto.randomUUID(), systemId, now, now, now),
    ).toThrow(/CHECK|constraint/i);
  });

  it("round-trips innerworldCanvas (1:1 pattern, systemId as PK)", () => {
    const systemId = setupSystem();
    const now = Date.now();

    db.insert(innerworldCanvas)
      .values({
        systemId,
        encryptedData: testBlob(new Uint8Array([100, 200, 255])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db
      .select()
      .from(innerworldCanvas)
      .where(eq(innerworldCanvas.systemId, systemId))
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.encryptedData).toEqual(testBlob(new Uint8Array([100, 200, 255])));
  });

  it("sets parentRegionId to null when parent region is deleted (SET NULL)", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const parentId = crypto.randomUUID();
    const childId = crypto.randomUUID();

    db.insert(innerworldRegions)
      .values({
        id: parentId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(innerworldRegions)
      .values({
        id: childId,
        systemId,
        parentRegionId: parentId,
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    client.exec(`DELETE FROM innerworld_regions WHERE id = '${parentId}'`);

    const rows = db.select().from(innerworldRegions).where(eq(innerworldRegions.id, childId)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.parentRegionId).toBeNull();
  });

  it("sets entity regionId to null when region is deleted (SET NULL)", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();
    const entityId = crypto.randomUUID();

    db.insert(innerworldRegions)
      .values({
        id: regionId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(innerworldEntities)
      .values({
        id: entityId,
        systemId,
        regionId,
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    client.exec(`DELETE FROM innerworld_regions WHERE id = '${regionId}'`);

    const rows = db
      .select()
      .from(innerworldEntities)
      .where(eq(innerworldEntities.id, entityId))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.regionId).toBeNull();
  });

  it("cascades system delete to all 3 innerworld tables", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();

    db.insert(innerworldRegions)
      .values({
        id: regionId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(innerworldEntities)
      .values({
        id: crypto.randomUUID(),
        systemId,
        regionId,
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(innerworldCanvas)
      .values({
        systemId,
        encryptedData: testBlob(new Uint8Array([3])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    client.exec(`DELETE FROM systems WHERE id = '${systemId}'`);

    expect(
      db.select().from(innerworldRegions).where(eq(innerworldRegions.systemId, systemId)).all(),
    ).toHaveLength(0);
    expect(
      db.select().from(innerworldEntities).where(eq(innerworldEntities.systemId, systemId)).all(),
    ).toHaveLength(0);
    expect(
      db.select().from(innerworldCanvas).where(eq(innerworldCanvas.systemId, systemId)).all(),
    ).toHaveLength(0);
  });

  it("enforces canvas 1:1 pattern (PK violation on duplicate systemId)", () => {
    const systemId = setupSystem();
    const now = Date.now();

    db.insert(innerworldCanvas)
      .values({
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    expect(() => {
      db.insert(innerworldCanvas)
        .values({
          systemId,
          encryptedData: testBlob(new Uint8Array([2])),
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }).toThrow();
  });
});
