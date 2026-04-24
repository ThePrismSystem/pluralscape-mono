import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

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

import type { InnerWorldEntityId, InnerWorldRegionId, SystemId } from "@pluralscape/types";
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

  afterEach(async () => {
    await db.delete(innerworldEntities);
    await db.delete(innerworldRegions);
  });

  async function setupSystem(): Promise<SystemId> {
    const accountId = await pgInsertAccount(db);
    return pgInsertSystem(db, accountId);
  }

  function newRegionId(): InnerWorldRegionId {
    return brandId<InnerWorldRegionId>(crypto.randomUUID());
  }

  function newEntityId(): InnerWorldEntityId {
    return brandId<InnerWorldEntityId>(crypto.randomUUID());
  }

  it("round-trips innerworldRegions with all fields", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const regionId = newRegionId();

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
    const regionId = newRegionId();

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
    const regionId = newRegionId();

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

  it("innerworld_regions updates archived from false to true", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const regionId = newRegionId();

    await db.insert(innerworldRegions).values({
      id: regionId,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });

    const archiveTime = Date.now();
    await db
      .update(innerworldRegions)
      .set({ archived: true, archivedAt: archiveTime })
      .where(eq(innerworldRegions.id, regionId));

    const rows = await db
      .select()
      .from(innerworldRegions)
      .where(eq(innerworldRegions.id, regionId));
    expect(rows[0]?.archived).toBe(true);
    expect(rows[0]?.archivedAt).toBe(archiveTime);
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
    const entityId = newEntityId();

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
    const entityId = newEntityId();

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
    const entityId = newEntityId();

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

  it("innerworld_entities updates archived from false to true", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const entityId = newEntityId();

    await db.insert(innerworldEntities).values({
      id: entityId,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    const archiveTime = Date.now();
    await db
      .update(innerworldEntities)
      .set({ archived: true, archivedAt: archiveTime })
      .where(eq(innerworldEntities.id, entityId));

    const rows = await db
      .select()
      .from(innerworldEntities)
      .where(eq(innerworldEntities.id, entityId));
    expect(rows[0]?.archived).toBe(true);
    expect(rows[0]?.archivedAt).toBe(archiveTime);
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

  it("restricts parent region deletion when referenced by child region", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const parentId = newRegionId();

    await db.insert(innerworldRegions).values({
      id: parentId,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(innerworldRegions).values({
      id: newRegionId(),
      systemId,
      parentRegionId: parentId,
      encryptedData: testBlob(new Uint8Array([2])),
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      client.query("DELETE FROM innerworld_regions WHERE id = $1", [parentId]),
    ).rejects.toThrow();
  });

  it("restricts region deletion when referenced by entity", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const regionId = newRegionId();

    await db.insert(innerworldRegions).values({
      id: regionId,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(innerworldEntities).values({
      id: newEntityId(),
      systemId,
      regionId,
      encryptedData: testBlob(new Uint8Array([2])),
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      client.query("DELETE FROM innerworld_regions WHERE id = $1", [regionId]),
    ).rejects.toThrow();
  });

  it("cascades system delete to all 3 innerworld tables", async () => {
    const systemId = await setupSystem();
    const now = Date.now();
    const regionId = newRegionId();

    await db.insert(innerworldRegions).values({
      id: regionId,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(innerworldEntities).values({
      id: newEntityId(),
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
