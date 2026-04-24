import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { sqliteCleanupAuditLog } from "../queries/audit-log-cleanup.js";
import { auditLog } from "../schema/sqlite/audit-log.js";
import { accounts } from "../schema/sqlite/auth.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteAuditLogTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { DbAuditActor } from "../helpers/types.js";
import type { AccountId, AuditLogEntryId, SystemId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, auditLog };

function testActor(id: string): DbAuditActor {
  return { kind: "account", id } as DbAuditActor;
}

describe("sqliteCleanupAuditLog", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteAuditLogTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(auditLog).run();
  });

  function insertAuditEntry(opts: {
    accountId: string;
    systemId: string;
    timestamp?: number;
  }): AuditLogEntryId {
    const id = brandId<AuditLogEntryId>(`al_${crypto.randomUUID()}`);
    db.insert(auditLog)
      .values({
        id,
        accountId: brandId<AccountId>(opts.accountId),
        systemId: brandId<SystemId>(opts.systemId),
        eventType: "auth.login",
        timestamp: opts.timestamp ?? Date.now(),
        actor: testActor(opts.accountId),
      })
      .run();
    return id;
  }

  it("deletes entries older than threshold", () => {
    const accountId = sqliteInsertAccount(db);
    const systemId = sqliteInsertSystem(db, accountId);

    const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const oldId = insertAuditEntry({ accountId, systemId, timestamp: thirtyDaysAgoMs });
    const recentId = insertAuditEntry({ accountId, systemId });

    const result = sqliteCleanupAuditLog(db, { olderThanDays: 7 });
    expect(result.deletedCount).toBe(1);

    const remaining = db.select().from(auditLog).all();
    expect(remaining.map((r) => r.id)).toContain(recentId);
    expect(remaining.map((r) => r.id)).not.toContain(oldId);
  });

  it("respects batchSize limit", () => {
    const accountId = sqliteInsertAccount(db);
    const systemId = sqliteInsertSystem(db, accountId);

    const oldTs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    insertAuditEntry({ accountId, systemId, timestamp: oldTs });
    insertAuditEntry({ accountId, systemId, timestamp: oldTs });
    insertAuditEntry({ accountId, systemId, timestamp: oldTs });

    const result = sqliteCleanupAuditLog(db, { olderThanDays: 7, batchSize: 2 });
    expect(result.deletedCount).toBe(2);

    const remaining = db.select().from(auditLog).all();
    expect(remaining).toHaveLength(1);
  });

  it("returns 0 when nothing to clean", () => {
    const result = sqliteCleanupAuditLog(db, { olderThanDays: 7 });
    expect(result.deletedCount).toBe(0);
  });
});
