import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { apiKeys } from "../schema/pg/api-keys.js";
import { accounts } from "../schema/pg/auth.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgApiKeysTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, apiKeys };

describe("PG api_keys schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgApiKeysTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it("inserts and retrieves a metadata API key", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();
    const tokenHash = `hash_${crypto.randomUUID()}`;

    await db.insert(apiKeys).values({
      id,
      accountId,
      systemId,
      encryptedData: testBlob(),
      keyType: "metadata",
      tokenHash,
      scopes: ["read:members", "read:fronting"],
      createdAt: now,
    });

    const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.accountId).toBe(accountId);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.keyType).toBe("metadata");
    expect(rows[0]?.tokenHash).toBe(tokenHash);
    expect(rows[0]?.scopes).toEqual(["read:members", "read:fronting"]);
    expect(rows[0]?.encryptedKeyMaterial).toBeNull();
  });

  it("inserts and retrieves a crypto API key", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();
    const tokenHash = `hash_${crypto.randomUUID()}`;
    const keyMaterial = new Uint8Array([1, 2, 3, 4, 5]);

    await db.insert(apiKeys).values({
      id,
      accountId,
      systemId,
      encryptedData: testBlob(),
      keyType: "crypto",
      tokenHash,
      scopes: ["full"],
      encryptedKeyMaterial: keyMaterial,
      scopedBucketIds: ["bucket-1", "bucket-2"],
      createdAt: now,
    });

    const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    expect(rows[0]?.keyType).toBe("crypto");
    expect(rows[0]?.encryptedKeyMaterial).toEqual(keyMaterial);
    expect(rows[0]?.scopedBucketIds).toEqual(["bucket-1", "bucket-2"]);
  });

  it("rejects invalid key_type via CHECK constraint", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();

    await expect(
      db.insert(apiKeys).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        encryptedData: testBlob(),
        keyType: "invalid" as "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["full"],
        createdAt: now,
      }),
    ).rejects.toThrow();
  });

  it("enforces unique token_hash", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const tokenHash = `hash_${crypto.randomUUID()}`;

    await db.insert(apiKeys).values({
      id: crypto.randomUUID(),
      accountId,
      systemId,
      encryptedData: testBlob(),
      keyType: "metadata",
      tokenHash,
      scopes: ["full"],
      createdAt: now,
    });

    await expect(
      db.insert(apiKeys).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        encryptedData: testBlob(),
        keyType: "metadata",
        tokenHash,
        scopes: ["full"],
        createdAt: now,
      }),
    ).rejects.toThrow();
  });

  it("allows nullable optional fields", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(apiKeys).values({
      id,
      accountId,
      systemId,
      encryptedData: testBlob(),
      keyType: "metadata",
      tokenHash: `hash_${crypto.randomUUID()}`,
      scopes: ["read:members"],
      createdAt: now,
    });

    const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    expect(rows[0]?.encryptedKeyMaterial).toBeNull();
    expect(rows[0]?.lastUsedAt).toBeNull();
    expect(rows[0]?.revokedAt).toBeNull();
    expect(rows[0]?.expiresAt).toBeNull();
    expect(rows[0]?.scopedBucketIds).toBeNull();
  });

  it("stores and retrieves timestamps (lastUsedAt, revokedAt, expiresAt)", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const later = now + 86400000;
    const id = crypto.randomUUID();

    await db.insert(apiKeys).values({
      id,
      accountId,
      systemId,
      encryptedData: testBlob(),
      keyType: "metadata",
      tokenHash: `hash_${crypto.randomUUID()}`,
      scopes: ["full"],
      createdAt: now,
      lastUsedAt: now,
      revokedAt: later,
      expiresAt: later,
    });

    const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    expect(rows[0]?.lastUsedAt).toBe(now);
    expect(rows[0]?.revokedAt).toBe(later);
    expect(rows[0]?.expiresAt).toBe(later);
  });

  it("cascades on account deletion", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(apiKeys).values({
      id,
      accountId,
      systemId,
      encryptedData: testBlob(),
      keyType: "metadata",
      tokenHash: `hash_${crypto.randomUUID()}`,
      scopes: ["full"],
      createdAt: now,
    });

    await db.delete(accounts).where(eq(accounts.id, accountId));
    const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    expect(rows).toHaveLength(0);
  });

  it("cascades on system deletion", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(apiKeys).values({
      id,
      accountId,
      systemId,
      encryptedData: testBlob(),
      keyType: "metadata",
      tokenHash: `hash_${crypto.randomUUID()}`,
      scopes: ["full"],
      createdAt: now,
    });

    await db.delete(systems).where(eq(systems.id, systemId));
    const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    expect(rows).toHaveLength(0);
  });

  it("rejects nonexistent accountId FK", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();

    await expect(
      db.insert(apiKeys).values({
        id: crypto.randomUUID(),
        accountId: "nonexistent",
        systemId,
        encryptedData: testBlob(),
        keyType: "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["full"],
        createdAt: now,
      }),
    ).rejects.toThrow();
  });

  it("rejects metadata key with encrypted_key_material", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();

    await expect(
      db.insert(apiKeys).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        encryptedData: testBlob(),
        keyType: "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["full"],
        encryptedKeyMaterial: new Uint8Array([1, 2, 3]),
        createdAt: now,
      }),
    ).rejects.toThrow();
  });

  it("rejects crypto key without encrypted_key_material", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();

    await expect(
      db.insert(apiKeys).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        encryptedData: testBlob(),
        keyType: "crypto",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["full"],
        createdAt: now,
      }),
    ).rejects.toThrow();
  });

  it("round-trips empty scopes array", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(apiKeys).values({
      id,
      accountId,
      systemId,
      encryptedData: testBlob(),
      keyType: "metadata",
      tokenHash: `hash_${crypto.randomUUID()}`,
      scopes: [],
      createdAt: now,
    });

    const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    expect(rows[0]?.scopes).toEqual([]);
  });

  it("rejects nonexistent systemId FK", async () => {
    const accountId = await insertAccount();
    const now = Date.now();

    await expect(
      db.insert(apiKeys).values({
        id: crypto.randomUUID(),
        accountId,
        systemId: "nonexistent",
        encryptedData: testBlob(),
        keyType: "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["full"],
        createdAt: now,
      }),
    ).rejects.toThrow();
  });

  it("round-trips encryptedData blob", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();
    const blob = testBlob(new Uint8Array([10, 20, 30]));

    await db.insert(apiKeys).values({
      id,
      accountId,
      systemId,
      keyType: "metadata",
      tokenHash: `hash_${crypto.randomUUID()}`,
      scopes: ["full"],
      encryptedData: blob,
      createdAt: now,
    });

    const rows = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    expect(rows[0]?.encryptedData).toEqual(blob);
  });
});
