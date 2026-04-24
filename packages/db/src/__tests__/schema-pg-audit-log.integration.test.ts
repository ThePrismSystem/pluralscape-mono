import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { auditLog } from "../schema/pg/audit-log.js";
import { accounts } from "../schema/pg/auth.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgAuditLogTables,
  makeAuditLogEntryId,
  pgInsertAccount,
  pgInsertSystem,
} from "./helpers/pg-helpers.js";

import type { DbAuditActor } from "../helpers/types.js";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, auditLog };

function testActor(kind: DbAuditActor["kind"], id: string): DbAuditActor {
  return { kind, id } as DbAuditActor;
}

describe("PG audit_log schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgAuditLogTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it("inserts and retrieves with all columns", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = makeAuditLogEntryId();
    const actor = testActor("account", accountId);

    await db.insert(auditLog).values({
      id,
      accountId,
      systemId,
      eventType: "auth.login",
      timestamp: now,
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      actor,
      detail: "Login from new device",
    });

    const rows = await db.select().from(auditLog).where(eq(auditLog.id, id));
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

  it("allows nullable fields (accountId, systemId, ipAddress, userAgent, detail)", async () => {
    const now = Date.now();
    const id = makeAuditLogEntryId();

    await db.insert(auditLog).values({
      id,
      eventType: "data.export",
      timestamp: now,
      actor: testActor("system", "sys-123"),
    });

    const rows = await db.select().from(auditLog).where(eq(auditLog.id, id));
    expect(rows[0]?.accountId).toBeNull();
    expect(rows[0]?.systemId).toBeNull();
    expect(rows[0]?.ipAddress).toBeNull();
    expect(rows[0]?.userAgent).toBeNull();
    expect(rows[0]?.detail).toBeNull();
  });

  it("rejects invalid event_type via CHECK constraint", async () => {
    const now = Date.now();

    await expect(
      db.insert(auditLog).values({
        id: makeAuditLogEntryId(),
        eventType: "invalid.event" as "auth.login",
        timestamp: now,
        actor: testActor("account", "acc-123"),
      }),
    ).rejects.toThrow();
  });

  it("supports all audit event types", async () => {
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

    const accountId = await insertAccount();
    const now = Date.now();
    for (const eventType of eventTypes) {
      await db.insert(auditLog).values({
        id: makeAuditLogEntryId(),
        accountId,
        eventType,
        timestamp: now,
        actor: testActor("account", accountId),
      });
    }

    const rows = await db.select().from(auditLog).where(eq(auditLog.accountId, accountId));
    const insertedTypes = new Set(rows.map((r) => r.eventType));
    for (const et of eventTypes) {
      expect(insertedTypes.has(et)).toBe(true);
    }
  });

  it("supports api-key actor type", async () => {
    const now = Date.now();
    const id = makeAuditLogEntryId();
    const actor = testActor("api-key", "key-123");

    await db.insert(auditLog).values({
      id,
      eventType: "data.export",
      timestamp: now,
      actor,
    });

    const rows = await db.select().from(auditLog).where(eq(auditLog.id, id));
    expect(rows[0]?.actor).toEqual({ kind: "api-key", id: "key-123" });
  });

  it("sets account_id to NULL on account deletion (SET NULL)", async () => {
    const accountId = await insertAccount();
    const now = Date.now();
    const id = makeAuditLogEntryId();

    await db.insert(auditLog).values({
      id,
      accountId,
      eventType: "auth.login",
      timestamp: now,
      actor: testActor("account", accountId),
    });

    await db.delete(accounts).where(eq(accounts.id, accountId));
    const rows = await db.select().from(auditLog).where(eq(auditLog.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.accountId).toBeNull();
  });

  it("sets system_id to NULL on system deletion (SET NULL)", async () => {
    const accountId = await insertAccount();
    const systemId = await pgInsertSystem(db, accountId);
    const now = Date.now();
    const id = makeAuditLogEntryId();

    await db.insert(auditLog).values({
      id,
      accountId,
      systemId,
      eventType: "member.created",
      timestamp: now,
      actor: testActor("account", accountId),
    });

    await db.delete(systems).where(eq(systems.id, systemId));
    const rows = await db.select().from(auditLog).where(eq(auditLog.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.systemId).toBeNull();
  });

  it("rejects duplicate composite primary key (same id + timestamp)", async () => {
    const now = Date.now();
    const id = makeAuditLogEntryId();

    await db.insert(auditLog).values({
      id,
      eventType: "auth.login",
      timestamp: now,
      actor: testActor("account", "acc-123"),
    });

    await expect(
      db.insert(auditLog).values({
        id,
        eventType: "auth.logout",
        timestamp: now,
        actor: testActor("account", "acc-123"),
      }),
    ).rejects.toThrow();
  });

  it("allows same id with different timestamps (composite PK)", async () => {
    const id = makeAuditLogEntryId();
    const now = Date.now();

    await db.insert(auditLog).values({
      id,
      eventType: "auth.login",
      timestamp: now,
      actor: testActor("account", "acc-1"),
    });

    await db.insert(auditLog).values({
      id,
      eventType: "auth.logout",
      timestamp: now + 1000,
      actor: testActor("account", "acc-1"),
    });

    const rows = await db.select().from(auditLog).where(eq(auditLog.id, id));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.eventType).sort()).toEqual(["auth.login", "auth.logout"]);
  });

  it("accepts detail at exactly 2048 characters", async () => {
    const now = Date.now();

    await db.insert(auditLog).values({
      id: makeAuditLogEntryId(),
      eventType: "auth.login",
      timestamp: now,
      actor: testActor("account", "acc-123"),
      detail: "x".repeat(2048),
    });
  });

  it("rejects detail exceeding 2048 characters", async () => {
    const now = Date.now();

    await expect(
      db.insert(auditLog).values({
        id: makeAuditLogEntryId(),
        eventType: "auth.login",
        timestamp: now,
        actor: testActor("account", "acc-123"),
        detail: "x".repeat(2049),
      }),
    ).rejects.toThrow();
  });
});
