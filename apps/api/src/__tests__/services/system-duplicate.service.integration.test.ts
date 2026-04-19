import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgSnapshotTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { duplicateSystem } from "../../services/system-duplicate.service.js";
import {
  asDb,
  assertApiError,
  genAccountId,
  makeAuth,
  noopAudit,
  spyAudit,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { systems, systemSnapshots } = schema;

describe("system-duplicate.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;
  let snapshotId: string;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgSnapshotTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);

    // Create a snapshot for the source system
    snapshotId = `snap_${crypto.randomUUID()}`;
    const now = Date.now();
    await db.insert(systemSnapshots).values({
      id: snapshotId,
      systemId,
      snapshotTrigger: "manual",
      encryptedData: testBlob(),
      createdAt: now,
    });
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    // Clean up any duplicated systems (keep original)
    const allSystems = await db.select({ id: systems.id }).from(systems);
    for (const sys of allSystems) {
      if (sys.id !== systemId) {
        await db.delete(systemSnapshots).where(eq(systemSnapshots.systemId, sys.id));
        await db.delete(systems).where(eq(systems.id, sys.id));
      }
    }
  });

  describe("duplicateSystem", () => {
    it("creates a new system from a snapshot", async () => {
      const audit = spyAudit();
      const result = await duplicateSystem(asDb(db), systemId, { snapshotId }, auth, audit);

      expect(result.id).toMatch(/^sys_/);
      expect(result.id).not.toBe(systemId);
      expect(result.sourceSnapshotId).toBe(snapshotId);

      // Verify the new system exists in DB
      const [newSystem] = await db.select().from(systems).where(eq(systems.id, result.id));
      expect(newSystem?.accountId).toBe(accountId);

      // Verify audit event
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("system.duplicated");
    });

    it("preserves source system after duplication", async () => {
      await duplicateSystem(asDb(db), systemId, { snapshotId }, auth, noopAudit);

      // Source system still exists
      const [sourceSystem] = await db.select().from(systems).where(eq(systems.id, systemId));
      expect(sourceSystem?.id).toBe(systemId);

      // Source snapshot still exists
      const [snapshot] = await db
        .select()
        .from(systemSnapshots)
        .where(eq(systemSnapshots.id, snapshotId));
      expect(snapshot?.id).toBe(snapshotId);
    });

    it("rejects duplication for nonexistent source system", async () => {
      const fakeSystemId = brandId<SystemId>(`sys_${crypto.randomUUID()}`);

      await assertApiError(
        duplicateSystem(asDb(db), fakeSystemId, { snapshotId }, auth, noopAudit),
        "NOT_FOUND",
        404,
        "Source system not found",
      );
    });

    it("rejects duplication for nonexistent snapshot", async () => {
      const fakeSnapshotId = `snap_${crypto.randomUUID()}`;

      await assertApiError(
        duplicateSystem(asDb(db), systemId, { snapshotId: fakeSnapshotId }, auth, noopAudit),
        "NOT_FOUND",
        404,
        "Snapshot not found",
      );
    });

    it("rejects duplication by a different account", async () => {
      const otherAccountId = genAccountId();
      const otherAuth = makeAuth(otherAccountId, systemId);

      await assertApiError(
        duplicateSystem(asDb(db), systemId, { snapshotId }, otherAuth, noopAudit),
        "NOT_FOUND",
        404,
        "Source system not found",
      );
    });

    it("rejects duplication for non-system account type", async () => {
      const nonSystemAuth: AuthContext = {
        ...auth,
        accountType: "viewer",
      };

      await assertApiError(
        duplicateSystem(asDb(db), systemId, { snapshotId }, nonSystemAuth, noopAudit),
        "FORBIDDEN",
        403,
      );
    });

    it("creates distinct new system per duplication call", async () => {
      const result1 = await duplicateSystem(asDb(db), systemId, { snapshotId }, auth, noopAudit);
      const result2 = await duplicateSystem(asDb(db), systemId, { snapshotId }, auth, noopAudit);

      expect(result1.id).not.toBe(result2.id);

      // All three systems exist
      const allSystems = await db.select({ id: systems.id }).from(systems);
      const ids = allSystems.map((s) => s.id);
      expect(ids).toContain(systemId);
      expect(ids).toContain(result1.id);
      expect(ids).toContain(result2.id);
    });
  });
});
