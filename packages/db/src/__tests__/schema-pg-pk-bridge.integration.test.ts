import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { pkBridgeConfigs } from "../schema/pg/pk-bridge.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgPkBridgeTables,
  makePkBridgeConfigId,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, pkBridgeConfigs };

describe("PG pk_bridge_configs schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgPkBridgeTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(pkBridgeConfigs);
  });

  it("round-trips insert and select with all fields", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const id = makePkBridgeConfigId();
    const now = Date.now();
    const syncAt = now - 60_000;
    const tokenCiphertext = new Uint8Array([10, 20, 30, 40]);
    const token = testBlob(tokenCiphertext);
    const mappings = testBlob(new Uint8Array([50, 60, 70]));
    const errors = testBlob(new Uint8Array([80, 90]));

    await db.insert(pkBridgeConfigs).values({
      id,
      systemId,
      enabled: true,
      syncDirection: "ps-to-pk",
      pkTokenEncrypted: token,
      entityMappings: mappings,
      errorLog: errors,
      lastSyncAt: syncAt,
      createdAt: now,
      updatedAt: now,
      version: 3,
    });

    const rows = await db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row?.id).toBe(id);
    expect(row?.systemId).toBe(systemId);
    expect(row?.enabled).toBe(true);
    expect(row?.syncDirection).toBe("ps-to-pk");
    expect(row?.pkTokenEncrypted.ciphertext).toEqual(tokenCiphertext);
    expect(row?.entityMappings.ciphertext).toEqual(mappings.ciphertext);
    expect(row?.errorLog.ciphertext).toEqual(errors.ciphertext);
    expect(row?.lastSyncAt).toBe(syncAt);
    expect(row?.createdAt).toBe(now);
    expect(row?.updatedAt).toBe(now);
    expect(row?.version).toBe(3);
  });

  it("defaults enabled to true when omitted", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const id = makePkBridgeConfigId();
    const now = Date.now();

    await db.insert(pkBridgeConfigs).values({
      id,
      systemId,
      syncDirection: "bidirectional",
      pkTokenEncrypted: testBlob(new Uint8Array([1])),
      entityMappings: testBlob(),
      errorLog: testBlob(),
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id));
    expect(rows[0]?.enabled).toBe(true);
  });

  it("accepts all valid syncDirection values", async () => {
    const directions = ["ps-to-pk", "pk-to-ps", "bidirectional"] as const;

    for (const dir of directions) {
      const accountId = await insertAccount();
      const systemId = await pgInsertSystem(db, accountId);
      const id = makePkBridgeConfigId();
      const now = Date.now();
      await db.insert(pkBridgeConfigs).values({
        id,
        systemId,
        syncDirection: dir,
        pkTokenEncrypted: testBlob(new Uint8Array([1])),
        entityMappings: testBlob(),
        errorLog: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id));
      expect(rows[0]?.syncDirection).toBe(dir);
    }
  });

  it("rejects invalid syncDirection via CHECK constraint", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);

    await expect(
      client.query(
        `INSERT INTO pk_bridge_configs (id, system_id, enabled, sync_direction, pk_token_encrypted, entity_mappings, error_log, created_at, updated_at, version)
         VALUES ($1, $2, true, 'invalid-dir', '\\x01', '\\x02', '\\x03', NOW(), NOW(), 1)`,
        [makePkBridgeConfigId(), systemId],
      ),
    ).rejects.toThrow();
  });

  it("allows null lastSyncAt", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const id = makePkBridgeConfigId();
    const now = Date.now();

    await db.insert(pkBridgeConfigs).values({
      id,
      systemId,
      syncDirection: "ps-to-pk",
      pkTokenEncrypted: testBlob(new Uint8Array([1])),
      entityMappings: testBlob(),
      errorLog: testBlob(),
      lastSyncAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id));
    expect(rows[0]?.lastSyncAt).toBeNull();
  });

  it("persists a non-null lastSyncAt value", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const id = makePkBridgeConfigId();
    const now = Date.now();
    const syncAt = now - 120_000;

    await db.insert(pkBridgeConfigs).values({
      id,
      systemId,
      syncDirection: "pk-to-ps",
      pkTokenEncrypted: testBlob(new Uint8Array([1])),
      entityMappings: testBlob(),
      errorLog: testBlob(),
      lastSyncAt: syncAt,
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id));
    expect(rows[0]?.lastSyncAt).toBe(syncAt);
  });

  it("round-trips larger binary data for all BYTEA columns", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const id = makePkBridgeConfigId();
    const now = Date.now();

    const tokenCiphertext = new Uint8Array(256);
    for (let i = 0; i < 256; i++) tokenCiphertext[i] = i;
    const token = testBlob(tokenCiphertext);
    const mappingsCiphertext = new Uint8Array(512);
    for (let i = 0; i < 512; i++) mappingsCiphertext[i] = i % 256;
    const errorsCiphertext = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) errorsCiphertext[i] = (i * 7) % 256;
    const mappings = testBlob(mappingsCiphertext);
    const errors = testBlob(errorsCiphertext);

    await db.insert(pkBridgeConfigs).values({
      id,
      systemId,
      syncDirection: "bidirectional",
      pkTokenEncrypted: token,
      entityMappings: mappings,
      errorLog: errors,
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id));
    expect(rows[0]?.pkTokenEncrypted.ciphertext).toEqual(tokenCiphertext);
    expect(rows[0]?.entityMappings.ciphertext).toEqual(mappingsCiphertext);
    expect(rows[0]?.errorLog.ciphertext).toEqual(errorsCiphertext);
  });

  it("cascades delete when parent system is deleted", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const id = makePkBridgeConfigId();
    const now = Date.now();

    await db.insert(pkBridgeConfigs).values({
      id,
      systemId,
      syncDirection: "ps-to-pk",
      pkTokenEncrypted: testBlob(new Uint8Array([1])),
      entityMappings: testBlob(),
      errorLog: testBlob(),
      createdAt: now,
      updatedAt: now,
    });

    // Verify it exists first
    const before = await db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id));
    expect(before).toHaveLength(1);

    // Delete the parent system via raw SQL to bypass any ORM protections
    await client.query("DELETE FROM systems WHERE id = $1", [systemId]);

    const after = await db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id));
    expect(after).toHaveLength(0);
  });

  it("defaults version to 1 when omitted", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const id = makePkBridgeConfigId();
    const now = Date.now();

    await db.insert(pkBridgeConfigs).values({
      id,
      systemId,
      syncDirection: "pk-to-ps",
      pkTokenEncrypted: testBlob(new Uint8Array([1])),
      entityMappings: testBlob(),
      errorLog: testBlob(),
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id));
    expect(rows[0]?.version).toBe(1);
  });

  it("rejects nonexistent systemId FK", async () => {
    const now = Date.now();
    await expect(
      db.insert(pkBridgeConfigs).values({
        id: makePkBridgeConfigId(),
        systemId: brandId<SystemId>("nonexistent-system-id"),
        syncDirection: "ps-to-pk",
        pkTokenEncrypted: testBlob(new Uint8Array([1])),
        entityMappings: testBlob(),
        errorLog: testBlob(),
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("stores enabled as false and retrieves it correctly", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const id = makePkBridgeConfigId();
    const now = Date.now();

    await db.insert(pkBridgeConfigs).values({
      id,
      systemId,
      enabled: false,
      syncDirection: "bidirectional",
      pkTokenEncrypted: testBlob(new Uint8Array([1])),
      entityMappings: testBlob(),
      errorLog: testBlob(),
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id));
    expect(rows[0]?.enabled).toBe(false);
  });
});
