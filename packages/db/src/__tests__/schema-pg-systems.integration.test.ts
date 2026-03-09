import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { systems } from "../schema/pg/systems.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

describe("PG systems schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<{ systems: typeof systems }>;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema: { systems } });

    await client.query(`
      CREATE TABLE systems (
        id VARCHAR(255) PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT,
        description TEXT,
        avatar_ref VARCHAR(255),
        settings_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);
  });

  afterAll(async () => {
    await client.close();
  });

  it("inserts and retrieves a system with all columns", async () => {
    const now = Date.now();
    const id = "sys_test-001";

    await db.insert(systems).values({
      id,
      name: "Test System",
      displayName: "Test Display",
      description: "A test system",
      avatarRef: "blob_avatar-001",
      settingsId: "sset_test-001",
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    const rows = await db.select().from(systems).where(eq(systems.id, id));
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row).toBeDefined();
    expect(row?.id).toBe(id);
    expect(row?.name).toBe("Test System");
    expect(row?.displayName).toBe("Test Display");
    expect(row?.description).toBe("A test system");
    expect(row?.avatarRef).toBe("blob_avatar-001");
    expect(row?.settingsId).toBe("sset_test-001");
    expect(row?.version).toBe(1);
  });

  it("round-trips timestamp values correctly", async () => {
    const now = 1704067200000; // 2024-01-01T00:00:00.000Z
    const id = "sys_test-002";

    await db.insert(systems).values({
      id,
      name: "Timestamp Test",
      settingsId: "sset_test-002",
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(systems).where(eq(systems.id, id));
    expect(rows[0]?.createdAt).toBe(now);
    expect(rows[0]?.updatedAt).toBe(now);
  });

  it("handles nullable columns correctly", async () => {
    const now = Date.now();
    const id = "sys_test-003";

    await db.insert(systems).values({
      id,
      name: "Nullable Test",
      settingsId: "sset_test-003",
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(systems).where(eq(systems.id, id));
    expect(rows[0]?.displayName).toBeNull();
    expect(rows[0]?.description).toBeNull();
    expect(rows[0]?.avatarRef).toBeNull();
  });
});
