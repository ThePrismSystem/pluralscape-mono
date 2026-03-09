import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { systems } from "../schema/sqlite/systems.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

describe("SQLite systems schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<{ systems: typeof systems }>;

  beforeAll(() => {
    client = new Database(":memory:");
    db = drizzle(client, { schema: { systems } });

    // Create the table using raw SQL matching the schema
    client.exec(`
      CREATE TABLE systems (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT,
        description TEXT,
        avatar_ref TEXT,
        settings_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);
  });

  afterAll(() => {
    client.close();
  });

  it("inserts and retrieves a system with all columns", () => {
    const now = Date.now();
    const id = `sys_${crypto.randomUUID()}`;
    const settingsId = `sset_${crypto.randomUUID()}`;

    db.insert(systems)
      .values({
        id,
        name: "Test System",
        displayName: "Test Display",
        description: "A test system",
        avatarRef: "blob_avatar-001",
        settingsId,
        createdAt: now,
        updatedAt: now,
        version: 1,
      })
      .run();

    const rows = db.select().from(systems).where(eq(systems.id, id)).all();
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row).toBeDefined();
    expect(row?.id).toBe(id);
    expect(row?.name).toBe("Test System");
    expect(row?.displayName).toBe("Test Display");
    expect(row?.description).toBe("A test system");
    expect(row?.avatarRef).toBe("blob_avatar-001");
    expect(row?.settingsId).toBe(settingsId);
    expect(row?.version).toBe(1);
  });

  it("round-trips timestamp values correctly", () => {
    const now = 1704067200000;
    const id = `sys_${crypto.randomUUID()}`;
    const settingsId = `sset_${crypto.randomUUID()}`;

    db.insert(systems)
      .values({
        id,
        name: "Timestamp Test",
        settingsId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(systems).where(eq(systems.id, id)).all();
    expect(rows[0]?.createdAt).toBe(now);
    expect(rows[0]?.updatedAt).toBe(now);
  });

  it("handles nullable columns correctly", () => {
    const now = Date.now();
    const id = `sys_${crypto.randomUUID()}`;
    const settingsId = `sset_${crypto.randomUUID()}`;

    db.insert(systems)
      .values({
        id,
        name: "Nullable Test",
        settingsId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(systems).where(eq(systems.id, id)).all();
    expect(rows[0]?.displayName).toBeNull();
    expect(rows[0]?.description).toBeNull();
    expect(rows[0]?.avatarRef).toBeNull();
  });

  it("defaults version to 1 when not specified", () => {
    const now = Date.now();
    const id = `sys_${crypto.randomUUID()}`;
    const settingsId = `sset_${crypto.randomUUID()}`;

    db.insert(systems)
      .values({
        id,
        name: "Version Default Test",
        settingsId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(systems).where(eq(systems.id, id)).all();
    expect(rows[0]?.version).toBe(1);
  });
});
