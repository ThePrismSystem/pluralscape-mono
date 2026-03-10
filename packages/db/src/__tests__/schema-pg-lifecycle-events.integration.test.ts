import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { lifecycleEvents } from "../schema/pg/lifecycle-events.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgLifecycleEventsTables,
  pgInsertAccount,
  pgInsertSystem,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, lifecycleEvents };

describe("PG lifecycle_events schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgLifecycleEventsTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it("inserts and retrieves with all columns", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const occurredAt = Date.now() - 86400000;
    const recordedAt = Date.now();
    const id = crypto.randomUUID();
    const data = new Uint8Array([10, 20, 30]);

    await db.insert(lifecycleEvents).values({
      id,
      systemId,
      occurredAt,
      recordedAt,
      encryptedData: data,
    });

    const rows = await db.select().from(lifecycleEvents).where(eq(lifecycleEvents.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.occurredAt).toBe(occurredAt);
    expect(rows[0]?.recordedAt).toBe(recordedAt);
    expect(rows[0]?.encryptedData).toEqual(data);
  });

  it("round-trips encrypted_data binary correctly", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();
    const blob = new Uint8Array(256);
    for (let i = 0; i < 256; i++) blob[i] = i;

    await db.insert(lifecycleEvents).values({
      id,
      systemId,
      occurredAt: now,
      recordedAt: now,
      encryptedData: blob,
    });

    const rows = await db.select().from(lifecycleEvents).where(eq(lifecycleEvents.id, id));
    expect(rows[0]?.encryptedData).toEqual(blob);
  });

  it("supports multiple events per system (append-only pattern)", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();

    for (let i = 0; i < 3; i++) {
      await db.insert(lifecycleEvents).values({
        id: crypto.randomUUID(),
        systemId,
        occurredAt: now + i * 1000,
        recordedAt: now + i * 1000,
        encryptedData: new Uint8Array([i]),
      });
    }

    const rows = await db
      .select()
      .from(lifecycleEvents)
      .where(eq(lifecycleEvents.systemId, systemId));
    expect(rows).toHaveLength(3);
  });

  it("cascades on system deletion", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(lifecycleEvents).values({
      id,
      systemId,
      occurredAt: now,
      recordedAt: now,
      encryptedData: new Uint8Array([1]),
    });

    await db.delete(systems).where(eq(systems.id, systemId));
    const rows = await db.select().from(lifecycleEvents).where(eq(lifecycleEvents.id, id));
    expect(rows).toHaveLength(0);
  });

  it("rejects nonexistent systemId FK", async () => {
    const now = Date.now();
    await expect(
      db.insert(lifecycleEvents).values({
        id: crypto.randomUUID(),
        systemId: "nonexistent",
        occurredAt: now,
        recordedAt: now,
        encryptedData: new Uint8Array([1]),
      }),
    ).rejects.toThrow();
  });

  it("rejects null encrypted_data via raw SQL", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);

    await expect(
      client.query(
        "INSERT INTO lifecycle_events (id, system_id, occurred_at, recorded_at, encrypted_data) VALUES ($1, $2, NOW(), NOW(), NULL)",
        [crypto.randomUUID(), systemId],
      ),
    ).rejects.toThrow();
  });

  it("rejects duplicate primary key", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    await db.insert(lifecycleEvents).values({
      id,
      systemId,
      occurredAt: now,
      recordedAt: now,
      encryptedData: new Uint8Array([1]),
    });

    await expect(
      db.insert(lifecycleEvents).values({
        id,
        systemId,
        occurredAt: now,
        recordedAt: now,
        encryptedData: new Uint8Array([2]),
      }),
    ).rejects.toThrow();
  });

  it("stores separate occurred_at and recorded_at timestamps", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const occurredAt = Date.now() - 604800000; // 1 week ago
    const recordedAt = Date.now();
    const id = crypto.randomUUID();

    await db.insert(lifecycleEvents).values({
      id,
      systemId,
      occurredAt,
      recordedAt,
      encryptedData: new Uint8Array([1]),
    });

    const rows = await db.select().from(lifecycleEvents).where(eq(lifecycleEvents.id, id));
    expect(rows[0]?.occurredAt).toBe(occurredAt);
    expect(rows[0]?.recordedAt).toBe(recordedAt);
    expect(rows[0]?.occurredAt).not.toBe(rows[0]?.recordedAt);
  });
});
