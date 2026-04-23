import { toUnixMillis, brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { jobs } from "../schema/sqlite/jobs.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteJobsTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { JobId, JobResult, JobType } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, jobs };

const newJobId = (): JobId => brandId<JobId>(`job_${crypto.randomUUID()}`);

describe("SQLite jobs schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteJobsTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(jobs).run();
  });

  describe("text primary key", () => {
    it("stores and retrieves a prefixed UUID as the primary key", () => {
      const now = Date.now();
      const id = newJobId();

      db.insert(jobs)
        .values({
          id,
          type: "sync-push",
          payload: { test: true },
          createdAt: now,
        })
        .run();

      const row = db.select().from(jobs).where(eq(jobs.id, id)).get();
      expect(row?.id).toBe(id);
      expect(typeof row?.id).toBe("string");
    });

    it("rejects duplicate primary keys", () => {
      const now = Date.now();
      const id = newJobId();

      db.insert(jobs).values({ id, type: "sync-push", payload: {}, createdAt: now }).run();

      expect(() =>
        db.insert(jobs).values({ id, type: "sync-pull", payload: {}, createdAt: now }).run(),
      ).toThrow(/UNIQUE|PRIMARY KEY/);
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
          id: newJobId(),
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
          id: newJobId(),
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
          id: newJobId(),
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

  describe("type CHECK constraint", () => {
    it("rejects invalid job type", () => {
      const now = Date.now();

      expect(() =>
        db.run(
          sql`INSERT INTO jobs (type, payload, status, created_at) VALUES ('nonexistent', '{}', 'pending', ${now})`,
        ),
      ).toThrow();
    });
  });

  describe("attempts CHECK constraint", () => {
    it("rejects attempts exceeding max_attempts", () => {
      const now = Date.now();

      expect(() =>
        db.run(
          sql`INSERT INTO jobs (type, payload, status, attempts, max_attempts, created_at) VALUES ('sync-push', '{}', 'pending', 6, 5, ${now})`,
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
          id: newJobId(),
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
            id: newJobId(),
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
            id: newJobId(),
            type: "blob-cleanup",
            payload: {},
            createdAt: now,
            idempotencyKey: null,
          })
          .run();
        db.insert(jobs)
          .values({
            id: newJobId(),
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
          id: newJobId(),
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
          id: newJobId(),
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

    it("transitions through pending -> running -> dead-letter with error", () => {
      const now = Date.now();

      const inserted = db
        .insert(jobs)
        .values({
          id: newJobId(),
          type: "webhook-deliver",
          payload: { url: "https://example.com" },
          createdAt: now,
        })
        .returning()
        .get();

      db.update(jobs)
        .set({
          status: "running",
          startedAt: now + 1000,
          attempts: 1,
        })
        .where(eq(jobs.id, inserted.id))
        .run();

      db.update(jobs)
        .set({
          status: "dead-letter",
          attempts: 5,
          error: "Connection timeout after 5 attempts",
          completedAt: now + 30000,
        })
        .where(eq(jobs.id, inserted.id))
        .run();

      const deadLettered = db.select().from(jobs).where(eq(jobs.id, inserted.id)).get();
      expect(deadLettered?.status).toBe("dead-letter");
      expect(deadLettered?.error).toBe("Connection timeout after 5 attempts");
      expect(deadLettered?.attempts).toBe(5);
    });
  });

  describe("new columns (ADR 010)", () => {
    it("round-trips heartbeat, timeout, result, scheduledFor, priority", () => {
      const now = Date.now();
      const result: JobResult = {
        success: true,
        message: "done",
        completedAt: toUnixMillis(now + 5000),
      };

      const inserted = db
        .insert(jobs)
        .values({
          id: newJobId(),
          type: "sync-push",
          payload: { test: true },
          createdAt: now,
          lastHeartbeatAt: now + 1000,
          timeoutMs: 60000,
          result,
          scheduledFor: now + 10000,
          priority: 5,
        })
        .returning()
        .get();

      expect(inserted.lastHeartbeatAt).toBe(now + 1000);
      expect(inserted.timeoutMs).toBe(60000);
      expect(inserted.result).toEqual(result);
      expect(inserted.scheduledFor).toBe(now + 10000);
      expect(inserted.priority).toBe(5);
    });

    it("defaults timeoutMs to 30000 and priority to 0", () => {
      const now = Date.now();

      const inserted = db
        .insert(jobs)
        .values({
          id: newJobId(),
          type: "blob-cleanup",
          payload: {},
          createdAt: now,
        })
        .returning()
        .get();

      expect(inserted.timeoutMs).toBe(30000);
      expect(inserted.priority).toBe(0);
      expect(inserted.lastHeartbeatAt).toBeNull();
      expect(inserted.result).toBeNull();
      expect(inserted.scheduledFor).toBeNull();
    });
  });

  describe("dead-letter status", () => {
    it("accepts attempts equal to maxAttempts for terminal states", () => {
      const now = Date.now();

      const inserted = db
        .insert(jobs)
        .values({
          id: newJobId(),
          type: "sync-push",
          payload: {},
          status: "dead-letter",
          attempts: 5,
          maxAttempts: 5,
          error: "Exhausted all retries",
          createdAt: now,
        })
        .returning()
        .get();

      expect(inserted.attempts).toBe(5);
      expect(inserted.maxAttempts).toBe(5);
      expect(inserted.status).toBe("dead-letter");
    });

    it("replays dead-letter -> pending with reset", () => {
      const now = Date.now();

      const inserted = db
        .insert(jobs)
        .values({
          id: newJobId(),
          type: "notification-send",
          payload: { recipient: "test" },
          status: "dead-letter",
          attempts: 5,
          error: "Permanently failed",
          createdAt: now,
        })
        .returning()
        .get();

      db.update(jobs)
        .set({ status: "pending", attempts: 0, error: null })
        .where(eq(jobs.id, inserted.id))
        .run();

      const replayed = db.select().from(jobs).where(eq(jobs.id, inserted.id)).get();
      expect(replayed?.status).toBe("pending");
      expect(replayed?.attempts).toBe(0);
      expect(replayed?.error).toBeNull();
    });
  });

  describe("timeoutMs CHECK constraint", () => {
    it("rejects non-positive timeoutMs", () => {
      const now = Date.now();

      expect(() =>
        db.run(
          sql`INSERT INTO jobs (type, payload, status, timeout_ms, created_at) VALUES ('sync-push', '{}', 'pending', 0, ${now})`,
        ),
      ).toThrow();

      expect(() =>
        db.run(
          sql`INSERT INTO jobs (type, payload, status, timeout_ms, created_at) VALUES ('sync-push', '{}', 'pending', -1, ${now})`,
        ),
      ).toThrow();
    });
  });

  describe("priority ordering", () => {
    it("orders jobs by priority ascending", () => {
      const now = Date.now();

      db.insert(jobs)
        .values([
          {
            id: newJobId(),
            type: "sync-push" as JobType,
            payload: {},
            createdAt: now,
            priority: 10,
          },
          {
            id: newJobId(),
            type: "sync-pull" as JobType,
            payload: {},
            createdAt: now,
            priority: 0,
          },
          {
            id: newJobId(),
            type: "blob-cleanup" as JobType,
            payload: {},
            createdAt: now,
            priority: 5,
          },
        ])
        .run();

      const ordered = db
        .select({ type: jobs.type, priority: jobs.priority })
        .from(jobs)
        .orderBy(asc(jobs.priority))
        .all();

      expect(ordered[0]?.priority).toBe(0);
      expect(ordered[1]?.priority).toBe(5);
      expect(ordered[2]?.priority).toBe(10);
    });
  });
});
