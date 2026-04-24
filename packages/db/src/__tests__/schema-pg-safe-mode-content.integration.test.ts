import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { safeModeContent } from "../schema/pg/safe-mode-content.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgSafeModeContentTables,
  makeSafeModeContentId,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, safeModeContent };

describe("PG safe_mode_content schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgSafeModeContentTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it("inserts and retrieves with all columns", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = makeSafeModeContentId();
    const data = testBlob(new Uint8Array([10, 20, 30]));

    await db.insert(safeModeContent).values({
      id,
      systemId,
      sortOrder: 1,
      encryptedData: data,
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(safeModeContent).where(eq(safeModeContent.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.sortOrder).toBe(1);
    expect(rows[0]?.encryptedData).toEqual(data);
    expect(rows[0]?.createdAt).toBe(now);
    expect(rows[0]?.updatedAt).toBe(now);
  });

  it("defaults version to 1", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = makeSafeModeContentId();

    await db.insert(safeModeContent).values({
      id,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(safeModeContent).where(eq(safeModeContent.id, id));
    expect(rows[0]?.version).toBe(1);
  });

  it("defaults sort_order to 0", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = makeSafeModeContentId();

    await db.insert(safeModeContent).values({
      id,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(safeModeContent).where(eq(safeModeContent.id, id));
    expect(rows[0]?.sortOrder).toBe(0);
  });

  it("supports multiple content items per system with ordering", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();

    const items = [
      { id: makeSafeModeContentId(), sortOrder: 3 },
      { id: makeSafeModeContentId(), sortOrder: 1 },
      { id: makeSafeModeContentId(), sortOrder: 2 },
    ];

    for (const item of items) {
      await db.insert(safeModeContent).values({
        id: item.id,
        systemId,
        sortOrder: item.sortOrder,
        encryptedData: testBlob(new Uint8Array([item.sortOrder])),
        createdAt: now,
        updatedAt: now,
      });
    }

    const rows = await db
      .select()
      .from(safeModeContent)
      .where(eq(safeModeContent.systemId, systemId));
    expect(rows).toHaveLength(3);
  });

  it("round-trips encrypted_data binary correctly", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = makeSafeModeContentId();
    const blobCiphertext = new Uint8Array(256);
    for (let i = 0; i < 256; i++) blobCiphertext[i] = i;
    const blob = testBlob(blobCiphertext);

    await db.insert(safeModeContent).values({
      id,
      systemId,
      encryptedData: blob,
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(safeModeContent).where(eq(safeModeContent.id, id));
    expect(rows[0]?.encryptedData).toEqual(blob);
  });

  it("cascades on system deletion", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = makeSafeModeContentId();

    await db.insert(safeModeContent).values({
      id,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    await db.delete(systems).where(eq(systems.id, systemId));
    const rows = await db.select().from(safeModeContent).where(eq(safeModeContent.id, id));
    expect(rows).toHaveLength(0);
  });

  it("rejects nonexistent systemId FK", async () => {
    const now = Date.now();
    await expect(
      db.insert(safeModeContent).values({
        id: makeSafeModeContentId(),
        systemId: brandId<SystemId>("nonexistent"),
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("rejects null encrypted_data via raw SQL", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);

    await expect(
      client.query(
        "INSERT INTO safe_mode_content (id, system_id, encrypted_data, created_at, updated_at, version) VALUES ($1, $2, NULL, NOW(), NOW(), 1)",
        [crypto.randomUUID(), systemId],
      ),
    ).rejects.toThrow();
  });

  it("rejects duplicate primary key", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = makeSafeModeContentId();

    await db.insert(safeModeContent).values({
      id,
      systemId,
      encryptedData: testBlob(new Uint8Array([1])),
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      db.insert(safeModeContent).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([2])),
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });
});
