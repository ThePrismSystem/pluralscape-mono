import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { systems } from "../schema/pg/systems.js";

import { createPgSystemTables, pgInsertAccount } from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems };

describe("PG systems schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgSystemTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it("inserts and retrieves with all columns", async () => {
    const accountId = await insertAccount();
    const now = Date.now();
    const id = crypto.randomUUID();
    const data = new Uint8Array([1, 2, 3, 4, 5]);

    await db.insert(systems).values({
      id,
      accountId,
      encryptedData: data,
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(systems).where(eq(systems.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(id);
    expect(rows[0]?.accountId).toBe(accountId);
    expect(rows[0]?.encryptedData).toEqual(data);
  });

  it("allows nullable encrypted_data", async () => {
    const accountId = await insertAccount();
    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(systems).values({
      id,
      accountId,
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(systems).where(eq(systems.id, id));
    expect(rows[0]?.encryptedData).toBeNull();
  });

  it("round-trips encrypted_data binary correctly", async () => {
    const accountId = await insertAccount();
    const now = Date.now();
    const id = crypto.randomUUID();
    const blob = new Uint8Array(256);
    for (let i = 0; i < 256; i++) blob[i] = i;

    await db.insert(systems).values({
      id,
      accountId,
      encryptedData: blob,
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(systems).where(eq(systems.id, id));
    expect(rows[0]?.encryptedData).toEqual(blob);
  });

  it("defaults version to 1", async () => {
    const accountId = await insertAccount();
    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(systems).values({
      id,
      accountId,
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(systems).where(eq(systems.id, id));
    expect(rows[0]?.version).toBe(1);
  });

  it("cascades on account deletion", async () => {
    const accountId = await insertAccount();
    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(systems).values({
      id,
      accountId,
      createdAt: now,
      updatedAt: now,
    });

    await db.delete(accounts).where(eq(accounts.id, accountId));
    const rows = await db.select().from(systems).where(eq(systems.id, id));
    expect(rows).toHaveLength(0);
  });

  it("rejects nonexistent accountId FK", async () => {
    const now = Date.now();
    await expect(
      db.insert(systems).values({
        id: crypto.randomUUID(),
        accountId: "nonexistent",
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("rejects duplicate primary key", async () => {
    const accountId = await insertAccount();
    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(systems).values({
      id,
      accountId,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      db.insert(systems).values({
        id,
        accountId,
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });
});
