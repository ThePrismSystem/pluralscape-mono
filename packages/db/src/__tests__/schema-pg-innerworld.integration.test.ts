import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  innerworldCanvas,
  innerworldEntities,
  innerworldRegions,
} from "../schema/pg/innerworld.js";

import { createPgInnerworldTables, pgInsertAccount, pgInsertSystem } from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

describe("PG Innerworld Schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<Record<string, unknown>>;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);
    await createPgInnerworldTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  async function setupSystem(): Promise<string> {
    const accountId = await pgInsertAccount(db);
    return pgInsertSystem(db, accountId);
  }

  it("round-trips innerworldRegions with all fields", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();

    await db.insert(innerworldRegions).values({
      id: regionId,
      systemId,
      parentRegionId: null,
      accessType: "open",
      gatekeeperMemberIds: ["member-1", "member-2"],
      encryptedData: new Uint8Array([1, 2, 3]),
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    const rows = await db
      .select()
      .from(innerworldRegions)
      .where(eq(innerworldRegions.id, regionId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(regionId);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.parentRegionId).toBeNull();
    expect(rows[0]?.accessType).toBe("open");
    expect(rows[0]?.gatekeeperMemberIds).toEqual(["member-1", "member-2"]);
    expect(rows[0]?.encryptedData).toEqual(new Uint8Array([1, 2, 3]));
    expect(rows[0]?.createdAt).toBe(now);
    expect(rows[0]?.updatedAt).toBe(now);
    expect(rows[0]?.version).toBe(1);
  });

  it("round-trips innerworldEntities with all fields", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const entityId = crypto.randomUUID();

    await db.insert(innerworldEntities).values({
      id: entityId,
      systemId,
      entityType: "member",
      regionId: null,
      positionX: 100,
      positionY: 200,
      encryptedData: new Uint8Array([4, 5, 6]),
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    const rows = await db
      .select()
      .from(innerworldEntities)
      .where(eq(innerworldEntities.id, entityId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(entityId);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.entityType).toBe("member");
    expect(rows[0]?.regionId).toBeNull();
    expect(rows[0]?.positionX).toBe(100);
    expect(rows[0]?.positionY).toBe(200);
    expect(rows[0]?.encryptedData).toEqual(new Uint8Array([4, 5, 6]));
  });

  it("round-trips innerworldCanvas (1:1 pattern, systemId as PK)", async () => {
    const systemId = await setupSystem();
    const now = Date.now();

    await db.insert(innerworldCanvas).values({
      systemId,
      encryptedData: new Uint8Array([10, 20, 30]),
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db
      .select()
      .from(innerworldCanvas)
      .where(eq(innerworldCanvas.systemId, systemId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.encryptedData).toEqual(new Uint8Array([10, 20, 30]));
  });

  it("sets parentRegionId to null when parent region is deleted (SET NULL)", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const parentId = crypto.randomUUID();
    const childId = crypto.randomUUID();

    await db.insert(innerworldRegions).values({
      id: parentId,
      systemId,
      accessType: "open",
      gatekeeperMemberIds: [],
      encryptedData: new Uint8Array([1]),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(innerworldRegions).values({
      id: childId,
      systemId,
      parentRegionId: parentId,
      accessType: "open",
      gatekeeperMemberIds: [],
      encryptedData: new Uint8Array([2]),
      createdAt: now,
      updatedAt: now,
    });

    await client.query("DELETE FROM innerworld_regions WHERE id = $1", [parentId]);

    const rows = await db.select().from(innerworldRegions).where(eq(innerworldRegions.id, childId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.parentRegionId).toBeNull();
  });

  it("sets entity regionId to null when region is deleted (SET NULL)", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();
    const entityId = crypto.randomUUID();

    await db.insert(innerworldRegions).values({
      id: regionId,
      systemId,
      accessType: "open",
      gatekeeperMemberIds: [],
      encryptedData: new Uint8Array([1]),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(innerworldEntities).values({
      id: entityId,
      systemId,
      entityType: "landmark",
      regionId,
      positionX: 50,
      positionY: 75,
      encryptedData: new Uint8Array([2]),
      createdAt: now,
      updatedAt: now,
    });

    await client.query("DELETE FROM innerworld_regions WHERE id = $1", [regionId]);

    const rows = await db
      .select()
      .from(innerworldEntities)
      .where(eq(innerworldEntities.id, entityId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.regionId).toBeNull();
  });

  it("enforces entity_type CHECK constraint with all valid values", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const validTypes = ["member", "landmark", "subsystem", "side-system", "layer"] as const;

    for (const entityType of validTypes) {
      const entityId = crypto.randomUUID();
      await db.insert(innerworldEntities).values({
        id: entityId,
        systemId,
        entityType,
        regionId: null,
        positionX: 0,
        positionY: 0,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(innerworldEntities)
        .where(eq(innerworldEntities.id, entityId));
      expect(rows[0]?.entityType).toBe(entityType);
    }

    await expect(
      client.query(
        `INSERT INTO innerworld_entities (id, system_id, entity_type, position_x, position_y, encrypted_data, created_at, updated_at, version) VALUES ($1, $2, 'invalid', 0, 0, $3, $4, $4, 1)`,
        [crypto.randomUUID(), systemId, new Uint8Array([1]), now],
      ),
    ).rejects.toThrow();
  });

  it("enforces access_type CHECK constraint on regions", async () => {
    const systemId = await setupSystem();
    const now = Date.now();

    for (const accessType of ["open", "gatekept"] as const) {
      const regionId = crypto.randomUUID();
      await db.insert(innerworldRegions).values({
        id: regionId,
        systemId,
        accessType,
        gatekeeperMemberIds: [],
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(innerworldRegions)
        .where(eq(innerworldRegions.id, regionId));
      expect(rows[0]?.accessType).toBe(accessType);
    }

    await expect(
      client.query(
        `INSERT INTO innerworld_regions (id, system_id, access_type, gatekeeper_member_ids, encrypted_data, created_at, updated_at, version) VALUES ($1, $2, 'invalid', '[]', $3, $4, $4, 1)`,
        [crypto.randomUUID(), systemId, new Uint8Array([1]), now],
      ),
    ).rejects.toThrow();
  });

  it("cascades system delete to all 3 innerworld tables", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();

    await db.insert(innerworldRegions).values({
      id: regionId,
      systemId,
      accessType: "open",
      gatekeeperMemberIds: [],
      encryptedData: new Uint8Array([1]),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(innerworldEntities).values({
      id: crypto.randomUUID(),
      systemId,
      entityType: "member",
      regionId,
      positionX: 10,
      positionY: 20,
      encryptedData: new Uint8Array([2]),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(innerworldCanvas).values({
      systemId,
      encryptedData: new Uint8Array([3]),
      createdAt: now,
      updatedAt: now,
    });

    await client.query("DELETE FROM systems WHERE id = $1", [systemId]);

    const regions = await db
      .select()
      .from(innerworldRegions)
      .where(eq(innerworldRegions.systemId, systemId));
    expect(regions).toHaveLength(0);

    const entities = await db
      .select()
      .from(innerworldEntities)
      .where(eq(innerworldEntities.systemId, systemId));
    expect(entities).toHaveLength(0);

    const canvases = await db
      .select()
      .from(innerworldCanvas)
      .where(eq(innerworldCanvas.systemId, systemId));
    expect(canvases).toHaveLength(0);
  });

  it("enforces canvas 1:1 pattern (PK violation on duplicate systemId)", async () => {
    const systemId = await setupSystem();
    const now = Date.now();

    await db.insert(innerworldCanvas).values({
      systemId,
      encryptedData: new Uint8Array([1]),
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      db.insert(innerworldCanvas).values({
        systemId,
        encryptedData: new Uint8Array([2]),
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("round-trips complex gatekeeperMemberIds JSON array", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();
    const complexArray = [
      "member-aaa-111",
      "member-bbb-222",
      "member-ccc-333",
      "member-ddd-444",
      "member-eee-555",
    ];

    await db.insert(innerworldRegions).values({
      id: regionId,
      systemId,
      accessType: "gatekept",
      gatekeeperMemberIds: complexArray,
      encryptedData: new Uint8Array([1]),
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db
      .select()
      .from(innerworldRegions)
      .where(eq(innerworldRegions.id, regionId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.gatekeeperMemberIds).toEqual(complexArray);
  });

  it("persists positionX/Y integer values including zero and negatives", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const testCases = [
      { x: 0, y: 0 },
      { x: -100, y: -200 },
      { x: 999999, y: 888888 },
      { x: -1, y: 1 },
    ];

    for (const { x, y } of testCases) {
      const entityId = crypto.randomUUID();
      await db.insert(innerworldEntities).values({
        id: entityId,
        systemId,
        entityType: "landmark",
        regionId: null,
        positionX: x,
        positionY: y,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(innerworldEntities)
        .where(eq(innerworldEntities.id, entityId));
      expect(rows[0]?.positionX).toBe(x);
      expect(rows[0]?.positionY).toBe(y);
    }
  });
});
