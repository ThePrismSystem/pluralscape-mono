import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditLog } from "../schema/sqlite/audit-log.js";
import { accounts } from "../schema/sqlite/auth.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteAuditLogTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { DbAuditActor } from "../helpers/types.js";
import type { AuditLogEntryId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, auditLog };

function testActor(kind: DbAuditActor["kind"], id: string): DbAuditActor {
  return { kind, id } as DbAuditActor;
}

describe("SQLite audit_log schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteAuditLogTables(client);
  });

  afterAll(() => {
    client.close();
  });

  it("inserts and retrieves with all columns (detail as text)", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = brandId<AuditLogEntryId>(`al_${crypto.randomUUID()}`);
    const actor = testActor("account", accountId);

    db.insert(auditLog)
      .values({
        id,
        accountId,
        systemId,
        eventType: "auth.login",
        timestamp: now,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        actor,
        detail: "Login from new device",
      })
      .run();

    const rows = db.select().from(auditLog).where(eq(auditLog.id, id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.accountId).toBe(accountId);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.eventType).toBe("auth.login");
    expect(rows[0]?.timestamp).toBe(now);
    expect(rows[0]?.ipAddress).toBe("192.168.1.1");
    expect(rows[0]?.userAgent).toBe("Mozilla/5.0");
    expect(rows[0]?.actor).toEqual({ kind: "account", id: accountId });
    expect(rows[0]?.detail).toBe("Login from new device");
  });

  it("allows nullable fields (accountId, systemId, ipAddress, userAgent, detail)", () => {
    const now = Date.now();
    const id = brandId<AuditLogEntryId>(`al_${crypto.randomUUID()}`);

    db.insert(auditLog)
      .values({
        id,
        eventType: "data.export",
        timestamp: now,
        actor: testActor("system", "sys-123"),
      })
      .run();

    const rows = db.select().from(auditLog).where(eq(auditLog.id, id)).all();
    expect(rows[0]?.accountId).toBeNull();
    expect(rows[0]?.systemId).toBeNull();
    expect(rows[0]?.ipAddress).toBeNull();
    expect(rows[0]?.userAgent).toBeNull();
    expect(rows[0]?.detail).toBeNull();
  });

  it("rejects invalid event_type via CHECK constraint", () => {
    const now = Date.now();

    expect(() =>
      db
        .insert(auditLog)
        .values({
          id: brandId<AuditLogEntryId>(`al_${crypto.randomUUID()}`),
          eventType: "invalid.event" as "auth.login",
          timestamp: now,
          actor: testActor("account", "acc-123"),
        })
        .run(),
    ).toThrow();
  });

  it("supports all audit event types (scoped query)", () => {
    const eventTypes = [
      "auth.login",
      "auth.login-failed",
      "auth.logout",
      "auth.password-changed",
      "auth.recovery-key-used",
      "auth.key-created",
      "auth.key-revoked",
      "data.export",
      "data.import",
      "data.purge",
      "settings.changed",
      "member.created",
      "member.archived",
      "sharing.granted",
      "sharing.revoked",
      "bucket.key_rotation.initiated",
      "bucket.key_rotation.chunk_completed",
      "bucket.key_rotation.completed",
      "bucket.key_rotation.failed",
      "device.security.jailbreak_warning_shown",
    ] as const;

    const accountId = insertAccount();
    const now = Date.now();
    for (const eventType of eventTypes) {
      db.insert(auditLog)
        .values({
          id: brandId<AuditLogEntryId>(`al_${crypto.randomUUID()}`),
          accountId,
          eventType,
          timestamp: now,
          actor: testActor("account", accountId),
        })
        .run();
    }

    const rows = db.select().from(auditLog).where(eq(auditLog.accountId, accountId)).all();
    const insertedTypes = new Set(rows.map((r) => r.eventType));
    for (const et of eventTypes) {
      expect(insertedTypes.has(et)).toBe(true);
    }
  });

  it("supports api-key actor type", () => {
    const now = Date.now();
    const id = brandId<AuditLogEntryId>(`al_${crypto.randomUUID()}`);
    const actor = testActor("api-key", "key-123");

    db.insert(auditLog)
      .values({
        id,
        eventType: "data.export",
        timestamp: now,
        actor,
      })
      .run();

    const rows = db.select().from(auditLog).where(eq(auditLog.id, id)).all();
    expect(rows[0]?.actor).toEqual({ kind: "api-key", id: "key-123" });
  });

  it("sets account_id to NULL on account deletion (SET NULL)", () => {
    const accountId = insertAccount();
    const now = Date.now();
    const id = brandId<AuditLogEntryId>(`al_${crypto.randomUUID()}`);

    db.insert(auditLog)
      .values({
        id,
        accountId,
        eventType: "auth.login",
        timestamp: now,
        actor: testActor("account", accountId),
      })
      .run();

    db.delete(accounts).where(eq(accounts.id, accountId)).run();
    const rows = db.select().from(auditLog).where(eq(auditLog.id, id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.accountId).toBeNull();
  });

  it("sets system_id to NULL on system deletion (SET NULL)", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = brandId<AuditLogEntryId>(`al_${crypto.randomUUID()}`);

    db.insert(auditLog)
      .values({
        id,
        accountId,
        systemId,
        eventType: "member.created",
        timestamp: now,
        actor: testActor("account", accountId),
      })
      .run();

    db.delete(systems).where(eq(systems.id, systemId)).run();
    const rows = db.select().from(auditLog).where(eq(auditLog.id, id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.systemId).toBeNull();
  });

  it("rejects duplicate primary key", () => {
    const now = Date.now();
    const id = brandId<AuditLogEntryId>(`al_${crypto.randomUUID()}`);

    db.insert(auditLog)
      .values({
        id,
        eventType: "auth.login",
        timestamp: now,
        actor: testActor("account", "acc-123"),
      })
      .run();

    expect(() =>
      db
        .insert(auditLog)
        .values({
          id,
          eventType: "auth.logout",
          timestamp: now,
          actor: testActor("account", "acc-123"),
        })
        .run(),
    ).toThrow(/UNIQUE|constraint/i);
  });

  it("accepts detail at exactly 2048 characters", () => {
    const now = Date.now();

    db.insert(auditLog)
      .values({
        id: brandId<AuditLogEntryId>(`al_${crypto.randomUUID()}`),
        eventType: "auth.login",
        timestamp: now,
        actor: testActor("account", "acc-123"),
        detail: "x".repeat(2048),
      })
      .run();
  });

  it("rejects detail exceeding 2048 characters", () => {
    const now = Date.now();

    expect(() =>
      db
        .insert(auditLog)
        .values({
          id: brandId<AuditLogEntryId>(`al_${crypto.randomUUID()}`),
          eventType: "auth.login",
          timestamp: now,
          actor: testActor("account", "acc-123"),
          detail: "x".repeat(2049),
        })
        .run(),
    ).toThrow(/CHECK|constraint/i);
  });
});
