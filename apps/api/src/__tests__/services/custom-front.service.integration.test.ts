import { PGlite } from "@electric-sql/pglite";
import { accounts, customFronts, frontingSessions, members, systems } from "@pluralscape/db/pg";
import {
  createPgFrontingTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  archiveCustomFront,
  createCustomFront,
  deleteCustomFront,
  getCustomFront,
  listCustomFronts,
  restoreCustomFront,
  updateCustomFront,
} from "../../services/custom-front.service.js";
import {
  assertApiError,
  genCustomFrontId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = {
  accounts,
  systems,
  members,
  customFronts,
  frontingSessions,
};

describe("custom-front.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgFrontingTables(client);

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(frontingSessions);
    await db.delete(customFronts);
  });

  describe("createCustomFront", () => {
    it("creates a custom front and returns expected shape", async () => {
      const audit = spyAudit();
      const result = await createCustomFront(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        audit,
      );

      expect(result.id).toMatch(/^cf_/);
      expect(result.systemId).toBe(systemId);
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
      expect(result.archivedAt).toBeNull();
      expect(typeof result.encryptedData).toBe("string");
      expect(typeof result.createdAt).toBe("number");
      expect(typeof result.updatedAt).toBe("number");
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("custom-front.created");
      expect(audit.calls[0]?.actor).toEqual({ kind: "account", id: auth.accountId });
    });
  });

  describe("getCustomFront", () => {
    it("retrieves a previously created custom front", async () => {
      const created = await createCustomFront(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const result = await getCustomFront(db as never, systemId, created.id, auth);

      expect(result.id).toBe(created.id);
      expect(result.systemId).toBe(systemId);
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
      expect(result.encryptedData).toBe(created.encryptedData);
      expect(result.createdAt).toBe(created.createdAt);
      expect(result.updatedAt).toBe(created.updatedAt);
    });

    it("throws NOT_FOUND for a non-existent ID", async () => {
      await assertApiError(
        getCustomFront(db as never, systemId, genCustomFrontId(), auth),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("listCustomFronts", () => {
    it("lists multiple custom fronts with pagination", async () => {
      await createCustomFront(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await createCustomFront(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await createCustomFront(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const page1 = await listCustomFronts(db as never, systemId, auth, undefined, 2);
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await listCustomFronts(db as never, systemId, auth, page1.items[1]?.id, 2);
      expect(page2.items).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
      expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
      expect(page2.items[0]?.id).not.toBe(page1.items[1]?.id);
    });
  });

  describe("updateCustomFront", () => {
    it("updates on correct version and increments version", async () => {
      const created = await createCustomFront(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      const result = await updateCustomFront(
        db as never,
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        audit,
      );

      expect(result.version).toBe(2);
      expect(result.id).toBe(created.id);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("custom-front.updated");
    });

    it("throws CONFLICT on stale version", async () => {
      const created = await createCustomFront(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await updateCustomFront(
        db as never,
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      await assertApiError(
        updateCustomFront(
          db as never,
          systemId,
          created.id,
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "CONFLICT",
        409,
      );
    });
  });

  describe("archiveCustomFront / restoreCustomFront", () => {
    it("archives a custom front so it is no longer returned by get", async () => {
      const created = await createCustomFront(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveCustomFront(db as never, systemId, created.id, auth, noopAudit);

      await assertApiError(
        getCustomFront(db as never, systemId, created.id, auth),
        "NOT_FOUND",
        404,
      );
    });

    it("restores an archived custom front", async () => {
      const created = await createCustomFront(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveCustomFront(db as never, systemId, created.id, auth, noopAudit);

      const restored = await restoreCustomFront(db as never, systemId, created.id, auth, noopAudit);

      expect(restored.archived).toBe(false);
      expect(restored.id).toBe(created.id);
      expect(restored.version).toBe(3);
    });
  });

  describe("deleteCustomFront", () => {
    it("deletes a custom front so it is no longer found", async () => {
      const created = await createCustomFront(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await deleteCustomFront(db as never, systemId, created.id, auth, audit);

      await assertApiError(
        getCustomFront(db as never, systemId, created.id, auth),
        "NOT_FOUND",
        404,
      );
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("custom-front.deleted");
    });
  });
});
