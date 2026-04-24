import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { pgCleanupAuditLog } from "../queries/audit-log-cleanup.js";
import { auditLog } from "../schema/pg/audit-log.js";
import { accounts } from "../schema/pg/auth.js";
import { systems } from "../schema/pg/systems.js";

import { createPgAuditLogTables, pgInsertAccount, pgInsertSystem } from "./helpers/pg-helpers.js";

import type { DbAuditActor } from "../helpers/types.js";
import type { AccountId, AuditLogEntryId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, auditLog };

function testActor(id: string): DbAuditActor {
  return { kind: "account", id } as DbAuditActor;
}

describe("pgCleanupAuditLog", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgAuditLogTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(auditLog);
  });

  async function insertAuditEntry(opts: {
    accountId: string;
    systemId: string;
    timestamp?: number;
  }): Promise<AuditLogEntryId> {
    const id = brandId<AuditLogEntryId>(`al_${crypto.randomUUID()}`);
    await db.insert(auditLog).values({
      id,
      accountId: brandId<AccountId>(opts.accountId),
      systemId: brandId<SystemId>(opts.systemId),
      eventType: "auth.login",
      timestamp: opts.timestamp ?? Date.now(),
      actor: testActor(opts.accountId),
    });
    return id;
  }

  it("deletes entries older than threshold", async () => {
    const accountId = await pgInsertAccount(db);
    const systemId = await pgInsertSystem(db, accountId);

    const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const oldId = await insertAuditEntry({ accountId, systemId, timestamp: thirtyDaysAgoMs });
    const recentId = await insertAuditEntry({ accountId, systemId });

    const result = await pgCleanupAuditLog(db, { olderThanDays: 7 });
    expect(result.deletedCount).toBe(1);

    const remaining = await db.select().from(auditLog);
    expect(remaining.map((r) => r.id)).toContain(recentId);
    expect(remaining.map((r) => r.id)).not.toContain(oldId);
  });

  it("returns 0 when nothing to clean", async () => {
    const result = await pgCleanupAuditLog(db, { olderThanDays: 7 });
    expect(result.deletedCount).toBe(0);
  });
});
