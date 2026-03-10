import Database from "better-sqlite3";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { jobs } from "../schema/sqlite/jobs.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteJobsTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, jobs };

describe("SQLite jobs schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteJobsTables(client);
  });

  afterAll(() => {
    client.close();
  });

  describe("autoincrement primary key", () => {
    it("assigns sequential integer IDs", () => {
      const now = Date.now();

      db.insert(jobs)
        .values({
          type: "sync-push",
          payload: { test: true },
          createdAt: now,
        })
        .run();

      db.insert(jobs)
        .values({
          type: "sync-pull",
          payload: { test: true },
          createdAt: now,
        })
        .run();

      const rows = db.select().from(jobs).all();
      expect(rows.length).toBeGreaterThanOrEqual(2);
      const ids = rows.map((r) => r.id);
      // IDs should be sequential integers
      for (const id of ids) {
        expect(typeof id).toBe("number");
        expect(id).toBeGreaterThan(0);
      }
      // Second should be greater than first
      const firstId = ids[0];
      const lastId = ids[ids.length - 1];
      expect(firstId).toBeDefined();
      expect(lastId).toBeGreaterThan(firstId ?? 0);
    });
  });

  describe("round-trip", () => {
    it("stores and retrieves all fields including JSON payload", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();
      const payload = { key: "value", nested: { count: 42 } };

      db.insert(jobs)
        .values({
          systemId,
          type: "export-generate",
          payload,
          status: "running",
          attempts: 2,
          maxAttempts: 10,
          nextRetryAt: now + 60000,
          error: "Previous attempt failed",
          createdAt: now,
          startedAt: now + 1000,
          completedAt: null,
          idempotencyKey: `idem-${crypto.randomUUID()}`,
        })
        .run();

      const rows = db.select().from(jobs).where(eq(jobs.systemId, systemId)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.type).toBe("export-generate");
      expect(rows[0]?.payload).toEqual(payload);
      expect(rows[0]?.status).toBe("running");
      expect(rows[0]?.attempts).toBe(2);
      expect(rows[0]?.maxAttempts).toBe(10);
      expect(rows[0]?.nextRetryAt).toBe(now + 60000);
      expect(rows[0]?.error).toBe("Previous attempt failed");
      expect(rows[0]?.createdAt).toBe(now);
      expect(rows[0]?.startedAt).toBe(now + 1000);
      expect(rows[0]?.completedAt).toBeNull();
    });
  });

  describe("defaults", () => {
    it("defaults status to pending, attempts to 0, maxAttempts to 5", () => {
      const now = Date.now();

      const result = db
        .insert(jobs)
        .values({
          type: "notification-send",
          payload: {},
          createdAt: now,
        })
        .returning()
        .get();

      expect(result.status).toBe("pending");
      expect(result.attempts).toBe(0);
      expect(result.maxAttempts).toBe(5);
    });
  });

  describe("nullable systemId", () => {
    it("allows null systemId for system-wide jobs", () => {
      const now = Date.now();

      const result = db
        .insert(jobs)
        .values({
          systemId: null,
          type: "analytics-compute",
          payload: { scope: "global" },
          createdAt: now,
        })
        .returning()
        .get();

      expect(result.systemId).toBeNull();
      expect(result.type).toBe("analytics-compute");
    });
  });

  describe("status CHECK constraint", () => {
    it("rejects invalid status values", () => {
      const now = Date.now();

      expect(() =>
        db.run(
          sql`INSERT INTO jobs (type, payload, status, created_at) VALUES ('sync-push', '{}', 'invalid-status', ${now})`,
        ),
      ).toThrow();
    });
  });

  describe("idempotency key unique constraint", () => {
    it("rejects duplicate idempotency keys", () => {
      const now = Date.now();
      const key = `unique-key-${crypto.randomUUID()}`;

      db.insert(jobs)
        .values({
          type: "webhook-deliver",
          payload: {},
          createdAt: now,
          idempotencyKey: key,
        })
        .run();

      expect(() =>
        db
          .insert(jobs)
          .values({
            type: "webhook-deliver",
            payload: {},
            createdAt: now,
            idempotencyKey: key,
          })
          .run(),
      ).toThrow(/UNIQUE/);
    });

    it("allows multiple null idempotency keys", () => {
      const now = Date.now();

      expect(() => {
        db.insert(jobs)
          .values({
            type: "blob-cleanup",
            payload: {},
            createdAt: now,
            idempotencyKey: null,
          })
          .run();
        db.insert(jobs)
          .values({
            type: "blob-cleanup",
            payload: {},
            createdAt: now,
            idempotencyKey: null,
          })
          .run();
      }).not.toThrow();
    });
  });

  describe("FK cascade", () => {
    it("cascades delete when system is deleted", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      db.insert(jobs)
        .values({
          systemId,
          type: "sync-push",
          payload: {},
          createdAt: now,
        })
        .run();

      const before = db.select().from(jobs).where(eq(jobs.systemId, systemId)).all();
      expect(before).toHaveLength(1);

      db.delete(systems).where(eq(systems.id, systemId)).run();

      const after = db.select().from(jobs).where(eq(jobs.systemId, systemId)).all();
      expect(after).toHaveLength(0);
    });
  });

  describe("job lifecycle", () => {
    it("transitions through pending -> running -> completed", () => {
      const now = Date.now();

      const inserted = db
        .insert(jobs)
        .values({
          type: "import-process",
          payload: { file: "import.json" },
          createdAt: now,
        })
        .returning()
        .get();

      expect(inserted.status).toBe("pending");

      db.update(jobs)
        .set({ status: "running", startedAt: now + 1000, attempts: 1 })
        .where(eq(jobs.id, inserted.id))
        .run();

      const running = db.select().from(jobs).where(eq(jobs.id, inserted.id)).get();
      expect(running?.status).toBe("running");
      expect(running?.attempts).toBe(1);

      db.update(jobs)
        .set({ status: "completed", completedAt: now + 5000 })
        .where(eq(jobs.id, inserted.id))
        .run();

      const completed = db.select().from(jobs).where(eq(jobs.id, inserted.id)).get();
      expect(completed?.status).toBe("completed");
      expect(completed?.completedAt).toBe(now + 5000);
    });

    it("transitions through pending -> running -> failed with error", () => {
      const now = Date.now();

      const inserted = db
        .insert(jobs)
        .values({
          type: "webhook-deliver",
          payload: { url: "https://example.com" },
          createdAt: now,
        })
        .returning()
        .get();

      db.update(jobs)
        .set({
          status: "failed",
          attempts: 5,
          error: "Connection timeout after 5 attempts",
          completedAt: now + 30000,
        })
        .where(eq(jobs.id, inserted.id))
        .run();

      const failed = db.select().from(jobs).where(eq(jobs.id, inserted.id)).get();
      expect(failed?.status).toBe("failed");
      expect(failed?.error).toBe("Connection timeout after 5 attempts");
      expect(failed?.attempts).toBe(5);
    });
  });
});
