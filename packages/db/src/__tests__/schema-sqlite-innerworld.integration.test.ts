import Database from "better-sqlite3";
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

  it("round-trips innerworldRegions with all fields including JSON", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();
    const gatekeepers = ["member-a", "member-b", "member-c"];

    db.insert(innerworldRegions)
      .values({
        id: regionId,
        systemId,
        parentRegionId: null,
        accessType: "gatekept",
        gatekeeperMemberIds: gatekeepers,
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
    expect(rows[0]?.accessType).toBe("gatekept");
    expect(rows[0]?.gatekeeperMemberIds).toEqual(gatekeepers);
    expect(rows[0]?.encryptedData).toEqual(testBlob(new Uint8Array([10, 20, 30])));
    expect(rows[0]?.createdAt).toBe(now);
    expect(rows[0]?.updatedAt).toBe(now);
    expect(rows[0]?.version).toBe(1);
  });

  it("round-trips innerworldEntities with all fields", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();

    db.insert(innerworldRegions)
      .values({
        id: regionId,
        systemId,
        accessType: "open",
        gatekeeperMemberIds: [],
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
        entityType: "landmark",
        positionX: 150,
        positionY: 300,
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
    expect(rows[0]?.entityType).toBe("landmark");
    expect(rows[0]?.positionX).toBe(150);
    expect(rows[0]?.positionY).toBe(300);
    expect(rows[0]?.encryptedData).toEqual(testBlob(new Uint8Array([40, 50, 60])));
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
        accessType: "open",
        gatekeeperMemberIds: [],
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
        accessType: "open",
        gatekeeperMemberIds: [],
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
        accessType: "open",
        gatekeeperMemberIds: [],
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(innerworldEntities)
      .values({
        id: entityId,
        systemId,
        entityType: "landmark",
        regionId,
        positionX: 10,
        positionY: 20,
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

  it("enforces entity_type CHECK constraint with all valid values", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const validTypes = ["member", "landmark", "subsystem", "side-system", "layer"] as const;

    for (const entityType of validTypes) {
      const entityId = crypto.randomUUID();
      db.insert(innerworldEntities)
        .values({
          id: entityId,
          systemId,
          entityType,
          regionId: null,
          positionX: 0,
          positionY: 0,
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
      expect(rows[0]?.entityType).toBe(entityType);
    }

    expect(() => {
      client
        .prepare(
          `INSERT INTO innerworld_entities (id, system_id, entity_type, position_x, position_y, encrypted_data, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(crypto.randomUUID(), systemId, "invalid", 0, 0, new Uint8Array([1]), now, now, 1);
    }).toThrow();
  });

  it("enforces access_type CHECK constraint on regions", () => {
    const systemId = setupSystem();
    const now = Date.now();

    for (const accessType of ["open", "gatekept"] as const) {
      const regionId = crypto.randomUUID();
      db.insert(innerworldRegions)
        .values({
          id: regionId,
          systemId,
          accessType,
          gatekeeperMemberIds: [],
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
      expect(rows[0]?.accessType).toBe(accessType);
    }

    expect(() => {
      client
        .prepare(
          `INSERT INTO innerworld_regions (id, system_id, access_type, gatekeeper_member_ids, encrypted_data, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(crypto.randomUUID(), systemId, "invalid", "[]", new Uint8Array([1]), now, now, 1);
    }).toThrow();
  });

  it("cascades system delete to all 3 innerworld tables", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();

    db.insert(innerworldRegions)
      .values({
        id: regionId,
        systemId,
        accessType: "open",
        gatekeeperMemberIds: [],
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(innerworldEntities)
      .values({
        id: crypto.randomUUID(),
        systemId,
        entityType: "member",
        regionId,
        positionX: 5,
        positionY: 10,
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

  it("round-trips complex gatekeeperMemberIds JSON array", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();
    const complexArray = [
      "member-aaa-111",
      "member-bbb-222",
      "member-ccc-333",
      "member-ddd-444",
      "member-eee-555",
    ];

    db.insert(innerworldRegions)
      .values({
        id: regionId,
        systemId,
        accessType: "gatekept",
        gatekeeperMemberIds: complexArray,
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

    expect(rows).toHaveLength(1);
    expect(rows[0]?.gatekeeperMemberIds).toEqual(complexArray);
  });

  it("persists positionX/Y integer values including zero and negatives", () => {
    const systemId = setupSystem();
    const now = Date.now();
    const testCases = [
      { x: 0, y: 0 },
      { x: -100, y: -200 },
      { x: 999999, y: 888888 },
      { x: -1, y: 1 },
    ];

    for (const { x, y } of testCases) {
      const entityId = crypto.randomUUID();
      db.insert(innerworldEntities)
        .values({
          id: entityId,
          systemId,
          entityType: "landmark",
          regionId: null,
          positionX: x,
          positionY: y,
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
      expect(rows[0]?.positionX).toBe(x);
      expect(rows[0]?.positionY).toBe(y);
    }
  });
});
