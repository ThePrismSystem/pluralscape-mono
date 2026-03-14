import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  innerworldCanvas,
  innerworldEntities,
  innerworldRegions,
} from "../schema/pg/innerworld.js";

import {
  createPgInnerworldTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

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
      encryptedData: testBlob(),
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
    expect(rows[0]?.encryptedData).toEqual(testBlob());
    expect(rows[0]?.createdAt).toBe(now);
    expect(rows[0]?.updatedAt).toBe(now);
    expect(rows[0]?.version).toBe(1);
    expect(rows[0]).not.toHaveProperty("gatekeeperMemberIds");
  });

  it("innerworld_regions defaults archived to false and archivedAt to null", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();

    await db.insert(innerworldRegions).values({
      id: regionId,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db
      .select()
      .from(innerworldRegions)
      .where(eq(innerworldRegions.id, regionId));
    expect(rows[0]?.archived).toBe(false);
    expect(rows[0]?.archivedAt).toBeNull();
  });

  it("innerworld_regions round-trips archived: true with archivedAt", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();

    await db.insert(innerworldRegions).values({
      id: regionId,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
      archived: true,
      archivedAt: now,
    });

    const rows = await db
      .select()
      .from(innerworldRegions)
      .where(eq(innerworldRegions.id, regionId));
    expect(rows[0]?.archived).toBe(true);
    expect(rows[0]?.archivedAt).toBe(now);
  });

  it("innerworld_regions rejects archived=true with archivedAt=null via CHECK", async () => {
    const systemId = await setupSystem();
    const now = Date.now();

    await expect(
      client.query(
        "INSERT INTO innerworld_regions (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x010203'::bytea, $3, $4, 1, true, NULL)",
        [crypto.randomUUID(), systemId, now, now],
      ),
    ).rejects.toThrow(/check|constraint/i);
  });

  it("innerworld_regions rejects archived=false with archivedAt set via CHECK", async () => {
    const systemId = await setupSystem();
    const now = Date.now();

    await expect(
      client.query(
        "INSERT INTO innerworld_regions (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x010203'::bytea, $3, $4, 1, false, $5)",
        [crypto.randomUUID(), systemId, now, now, now],
      ),
    ).rejects.toThrow(/check|constraint/i);
  });

  it("round-trips innerworldEntities with all fields", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const entityId = crypto.randomUUID();

    await db.insert(innerworldEntities).values({
      id: entityId,
      systemId,
      regionId: null,
      encryptedData: testBlob(new Uint8Array([4, 5, 6])),
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
    expect(rows[0]?.regionId).toBeNull();
    expect(rows[0]?.encryptedData).toEqual(testBlob(new Uint8Array([4, 5, 6])));
  });

  it("innerworld_entities defaults archived to false and archivedAt to null", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const entityId = crypto.randomUUID();

    await db.insert(innerworldEntities).values({
      id: entityId,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db
      .select()
      .from(innerworldEntities)
      .where(eq(innerworldEntities.id, entityId));
    expect(rows[0]?.archived).toBe(false);
    expect(rows[0]?.archivedAt).toBeNull();
  });

  it("innerworld_entities round-trips archived: true with archivedAt", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const entityId = crypto.randomUUID();

    await db.insert(innerworldEntities).values({
      id: entityId,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
      archived: true,
      archivedAt: now,
    });

    const rows = await db
      .select()
      .from(innerworldEntities)
      .where(eq(innerworldEntities.id, entityId));
    expect(rows[0]?.archived).toBe(true);
    expect(rows[0]?.archivedAt).toBe(now);
  });

  it("innerworld_entities rejects archived=true with archivedAt=null via CHECK", async () => {
    const systemId = await setupSystem();
    const now = Date.now();

    await expect(
      client.query(
        "INSERT INTO innerworld_entities (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x010203'::bytea, $3, $4, 1, true, NULL)",
        [crypto.randomUUID(), systemId, now, now],
      ),
    ).rejects.toThrow(/check|constraint/i);
  });

  it("innerworld_entities rejects archived=false with archivedAt set via CHECK", async () => {
    const systemId = await setupSystem();
    const now = Date.now();

    await expect(
      client.query(
        "INSERT INTO innerworld_entities (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x010203'::bytea, $3, $4, 1, false, $5)",
        [crypto.randomUUID(), systemId, now, now, now],
      ),
    ).rejects.toThrow(/check|constraint/i);
  });

  it("round-trips innerworldCanvas (1:1 pattern, systemId as PK)", async () => {
    const systemId = await setupSystem();
    const now = Date.now();

    await db.insert(innerworldCanvas).values({
      systemId,
      encryptedData: testBlob(new Uint8Array([10, 20, 30])),
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db
      .select()
      .from(innerworldCanvas)
      .where(eq(innerworldCanvas.systemId, systemId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.encryptedData).toEqual(testBlob(new Uint8Array([10, 20, 30])));
  });

  it("sets parentRegionId to null when parent region is deleted (SET NULL)", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const parentId = crypto.randomUUID();
    const childId = crypto.randomUUID();

    await db.insert(innerworldRegions).values({
      id: parentId,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(innerworldRegions).values({
      id: childId,
      systemId,
      parentRegionId: parentId,
      encryptedData: testBlob(new Uint8Array([2])),
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
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(innerworldEntities).values({
      id: entityId,
      systemId,
      regionId,
      encryptedData: testBlob(new Uint8Array([2])),
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

  it("cascades system delete to all 3 innerworld tables", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const regionId = crypto.randomUUID();

    await db.insert(innerworldRegions).values({
      id: regionId,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(innerworldEntities).values({
      id: crypto.randomUUID(),
      systemId,
      regionId,
      encryptedData: testBlob(new Uint8Array([2])),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(innerworldCanvas).values({
      systemId,
      encryptedData: testBlob(new Uint8Array([3])),
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
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      db.insert(innerworldCanvas).values({
        systemId,
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });
});
