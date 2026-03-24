import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgMemberTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  archiveSystem,
  getSystemProfile,
  listSystems,
  updateSystemProfile,
} from "../../services/system.service.js";
import {
  asDb,
  assertApiError,
  genAccountId,
  makeAuth,
  noopAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { systems, members } = schema;

describe("system.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgMemberTables(client);

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(members);
    // Restore any archived systems back to non-archived for test isolation
    await db.update(systems).set({ archived: false, archivedAt: null });
  });

  describe("getSystemProfile", () => {
    it("returns profile with id matching systemId", async () => {
      const result = await getSystemProfile(asDb(db), systemId, auth);

      expect(result.id).toBe(systemId);
      expect(result.version).toBeTypeOf("number");
      expect(result.createdAt).toBeTypeOf("number");
      expect(result.updatedAt).toBeTypeOf("number");
    });

    it("throws NOT_FOUND when auth belongs to a different account", async () => {
      const otherAccountId = genAccountId();
      const otherAuth = makeAuth(otherAccountId, systemId);

      await assertApiError(getSystemProfile(asDb(db), systemId, otherAuth), "NOT_FOUND", 404);
    });
  });

  describe("listSystems", () => {
    it("returns systems for account with pagination shape", async () => {
      const result = await listSystems(asDb(db), accountId);

      expect(result.items).toBeInstanceOf(Array);
      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result).toHaveProperty("hasMore");
      expect(result.items[0]?.id).toBe(systemId);
    });
  });

  describe("updateSystemProfile", () => {
    it("updates encrypted data and increments version", async () => {
      const initial = await getSystemProfile(asDb(db), systemId, auth);

      const result = await updateSystemProfile(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), version: initial.version },
        auth,
        noopAudit,
      );

      expect(result.version).toBe(initial.version + 1);
      expect(result.encryptedData).toBeTypeOf("string");
    });

    it("throws CONFLICT on stale version", async () => {
      const current = await getSystemProfile(asDb(db), systemId, auth);
      // Advance to version+1
      await updateSystemProfile(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64(), version: current.version },
        auth,
        noopAudit,
      );

      // Try updating with the now-stale version
      await assertApiError(
        updateSystemProfile(
          asDb(db),
          systemId,
          { encryptedData: testEncryptedDataBase64(), version: current.version },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });
  });

  describe("archiveSystem (delete)", () => {
    it("throws HAS_DEPENDENTS when system has members", async () => {
      // Need a second system so "last system" check doesn't trigger first
      const secondSystemId = (await pgInsertSystem(db, accountId)) as SystemId;
      const secondAuth = makeAuth(accountId, secondSystemId);
      await pgInsertMember(db, secondSystemId);

      await assertApiError(
        archiveSystem(asDb(db), secondSystemId, secondAuth, noopAudit),
        "HAS_DEPENDENTS",
        409,
      );
    });

    it("succeeds when system has no members and is not the last system", async () => {
      // Create a fresh system with no members (shared system still exists)
      const freshSystemId = (await pgInsertSystem(db, accountId)) as SystemId;
      const freshAuth = makeAuth(accountId, freshSystemId);

      await archiveSystem(asDb(db), freshSystemId, freshAuth, noopAudit);

      // Confirm it's no longer visible via getSystemProfile
      await assertApiError(getSystemProfile(asDb(db), freshSystemId, freshAuth), "NOT_FOUND", 404);
    });
  });
});
