import Database from "better-sqlite3-multiple-ciphers";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SqliteJobQueue } from "../adapters/sqlite/sqlite-job-queue.js";
import { SqliteJobWorker } from "../adapters/sqlite/sqlite-job-worker.js";

import { dequeueOrFail, makeJobParams } from "./helpers.js";
import { runJobQueueContract } from "./job-queue.contract.js";
import { runJobWorkerContract } from "./job-worker.contract.js";

import type { Logger, UnixMillis } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const mockLogger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const JOBS_DDL = sql`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    system_id TEXT,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    next_retry_at INTEGER,
    error TEXT,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,
    idempotency_key TEXT,
    last_heartbeat_at INTEGER,
    timeout_ms INTEGER NOT NULL DEFAULT 30000,
    result TEXT,
    scheduled_for INTEGER,
    priority INTEGER NOT NULL DEFAULT 0
  )
`;

const IDEMPOTENCY_INDEX = sql`
  CREATE UNIQUE INDEX IF NOT EXISTS jobs_idempotency_key_idx ON jobs(idempotency_key)
`;

const PRIORITY_INDEX = sql`
  CREATE INDEX IF NOT EXISTS jobs_priority_status_scheduled_idx ON jobs(priority, status, scheduled_for)
`;

let client: InstanceType<typeof Database>;
let db: BetterSQLite3Database;

function createQueue(options?: { clock?: () => UnixMillis; logger?: Logger }): SqliteJobQueue {
  return new SqliteJobQueue(db, { logger: options?.logger ?? mockLogger, clock: options?.clock });
}

beforeAll(() => {
  client = new Database(":memory:");
  db = drizzle(client);
  db.run(JOBS_DDL);
  db.run(IDEMPOTENCY_INDEX);
  db.run(PRIORITY_INDEX);
});

afterEach(() => {
  db.run(sql`DELETE FROM jobs`);
});

afterAll(() => {
  client.close();
});

// ── Contract tests ─────────────────────────────────────────────────

describe("SqliteJobQueue", () => {
  runJobQueueContract(() => createQueue());
});

describe("SqliteJobWorker", () => {
  runJobWorkerContract(
    () => createQueue(),
    (queue) => new SqliteJobWorker(queue, { pollIntervalMs: 50, logger: mockLogger }),
  );
});

// ── SQLite-specific tests ──────────────────────────────────────────

describe("SqliteJobQueue-specific", () => {
  describe("findStalledJobs", () => {
    it("detects a stalled job when heartbeat timeout has elapsed", async () => {
      let currentTime = 1000 as UnixMillis;
      const queue = createQueue({ clock: () => currentTime });

      await queue.enqueue(makeJobParams({ timeoutMs: 5000 }));
      await queue.dequeue();

      currentTime = 7000 as UnixMillis;
      const stalled = await queue.findStalledJobs();
      expect(stalled).toHaveLength(1);
      expect(stalled[0]?.status).toBe("running");
    });

    it("does not report a job as stalled when heartbeat resets the clock", async () => {
      let currentTime = 1000 as UnixMillis;
      const queue = createQueue({ clock: () => currentTime });

      await queue.enqueue(makeJobParams({ timeoutMs: 5000 }));
      const job = await dequeueOrFail(queue);

      currentTime = 4000 as UnixMillis;
      await queue.heartbeat(job.id);

      currentTime = 8000 as UnixMillis;
      const stalled = await queue.findStalledJobs();
      expect(stalled).toHaveLength(0);
    });
  });

  describe("idempotency key re-use after completion", () => {
    it("allows re-enqueue with the same key after the first job completes", async () => {
      const queue = createQueue();
      const key = "reuse-key";
      await queue.enqueue(makeJobParams({ idempotencyKey: key }));
      const first = await dequeueOrFail(queue);
      await queue.acknowledge(first.id, {});

      const second = await queue.enqueue(makeJobParams({ idempotencyKey: key }));
      expect(second.status).toBe("pending");
      expect(second.id).not.toBe(first.id);
    });
  });

  describe("logger forwarding", () => {
    it("forwards logger to fireHook when hook throws", async () => {
      const errorFn = vi.fn();
      const queue = createQueue({ logger: { info: vi.fn(), warn: vi.fn(), error: errorFn } });
      queue.setEventHooks({
        onComplete: () => {
          throw new Error("hook exploded");
        },
      });
      await queue.enqueue(makeJobParams());
      const job = await dequeueOrFail(queue);
      await queue.acknowledge(job.id, {});
      expect(errorFn).toHaveBeenCalledWith(
        "hook.error",
        expect.objectContaining({ error: "hook exploded" }),
      );
    });
  });
});
