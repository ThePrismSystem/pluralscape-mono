import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { systemSettings } from "../schema/pg/system-settings.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createPgSystemSettingsTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { SystemId, SystemSettingsId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, systemSettings };

describe("PG system_settings schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgSystemSettingsTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it("inserts and retrieves with all columns", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = fixtureNow();
    const data = testBlob(new Uint8Array([10, 20, 30]));

    await db.insert(systemSettings).values({
      id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
      systemId,
      locale: "en-US",
      pinHash: "$argon2id$hash123",
      biometricEnabled: true,
      encryptedData: data,
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.locale).toBe("en-US");
    expect(rows[0]?.pinHash).toBe("$argon2id$hash123");
    expect(rows[0]?.biometricEnabled).toBe(true);
    expect(rows[0]?.encryptedData).toEqual(data);
  });

  it("defaults boolean fields to false", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = fixtureNow();

    await db.insert(systemSettings).values({
      id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId));
    expect(rows[0]?.biometricEnabled).toBe(false);
  });

  it("allows nullable locale and pinHash", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = fixtureNow();

    await db.insert(systemSettings).values({
      id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId));
    expect(rows[0]?.locale).toBeNull();
    expect(rows[0]?.pinHash).toBeNull();
  });

  it("defaults version to 1", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = fixtureNow();

    await db.insert(systemSettings).values({
      id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId));
    expect(rows[0]?.version).toBe(1);
  });

  it("enforces 1:1 with systems (rejects duplicate systemId)", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = fixtureNow();

    await db.insert(systemSettings).values({
      id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      db.insert(systemSettings).values({
        id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
        systemId,
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("cascades on system deletion", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = fixtureNow();

    await db.insert(systemSettings).values({
      id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    await db.delete(systems).where(eq(systems.id, systemId));
    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId));
    expect(rows).toHaveLength(0);
  });

  it("rejects nonexistent systemId FK", async () => {
    const now = fixtureNow();
    await expect(
      db.insert(systemSettings).values({
        id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
        systemId: brandId<SystemId>("nonexistent"),
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("rejects pinHash that does not start with $argon2id$", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);

    await expect(
      client.query(
        "INSERT INTO system_settings (id, system_id, pin_hash, encrypted_data, created_at, updated_at, version) VALUES ($1, $2, 'bcrypt$hash', '\\x0102'::bytea, NOW(), NOW(), 1)",
        [`sset_${crypto.randomUUID()}`, systemId],
      ),
    ).rejects.toThrow(/check|constraint/i);
  });

  it("rejects null encrypted_data via raw SQL", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);

    await expect(
      client.query(
        "INSERT INTO system_settings (system_id, encrypted_data, created_at, updated_at, version) VALUES ($1, NULL, NOW(), NOW(), 1)",
        [systemId],
      ),
    ).rejects.toThrow();
  });

  it("round-trips encrypted_data binary correctly", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = fixtureNow();
    const blobCiphertext = new Uint8Array(256);
    for (let i = 0; i < 256; i++) blobCiphertext[i] = i;
    const blob = testBlob(blobCiphertext);

    await db.insert(systemSettings).values({
      id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
      systemId,
      encryptedData: blob,
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId));
    expect(rows[0]?.encryptedData).toEqual(blob);
  });
});
