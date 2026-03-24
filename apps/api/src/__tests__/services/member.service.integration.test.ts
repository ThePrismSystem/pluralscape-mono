import { PGlite } from "@electric-sql/pglite";
import { accounts, members, systems } from "@pluralscape/db/pg";
import {
  createPgAllTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  archiveMember,
  createMember,
  deleteMember,
  getMember,
  listMembers,
  restoreMember,
  updateMember,
} from "../../services/member.service.js";
import {
  assertApiError,
  genMemberId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, members };

describe("member.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgAllTables(client);

    accountId = (await pgInsertAccount(db)) as AccountId;
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(members);
  });

  describe("createMember", () => {
    it("creates a member with correct id prefix and version", async () => {
      const result = await createMember(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      expect(result.id).toMatch(/^mem_/);
      expect(result.version).toBe(1);
      expect(result.systemId).toBe(systemId);
      expect(result.archived).toBe(false);
      expect(result.archivedAt).toBeNull();
    });

    it("writes an audit entry on create", async () => {
      const audit = spyAudit();
      await createMember(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        audit,
      );

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("member.created");
      expect(audit.calls[0]?.actor).toEqual({ kind: "account", id: auth.accountId });
    });
  });

  describe("getMember", () => {
    it("returns a previously created member", async () => {
      const created = await createMember(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const result = await getMember(db as never, systemId, created.id, auth);

      expect(result.id).toBe(created.id);
      expect(result.systemId).toBe(systemId);
      expect(result.version).toBe(created.version);
      expect(result.encryptedData).toBe(created.encryptedData);
    });

    it("throws NOT_FOUND for a non-existent member", async () => {
      await assertApiError(getMember(db as never, systemId, genMemberId(), auth), "NOT_FOUND", 404);
    });

    it("throws NOT_FOUND when queried with a different system's auth", async () => {
      const created = await createMember(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const otherAccountId = (await pgInsertAccount(db)) as AccountId;
      const otherSystemId = (await pgInsertSystem(db, otherAccountId)) as SystemId;
      const otherAuth = makeAuth(otherAccountId, otherSystemId);

      await assertApiError(
        getMember(db as never, otherSystemId, created.id, otherAuth),
        "NOT_FOUND",
        404,
      );
    });
  });

  describe("listMembers", () => {
    it("paginates with limit and cursor", async () => {
      await createMember(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await createMember(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await createMember(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const page1 = await listMembers(db as never, systemId, auth, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      // listMembers accepts a raw ID as cursor (route layer decodes the opaque cursor)
      const lastItemId = page1.items[page1.items.length - 1]?.id;
      expect(lastItemId).toBeDefined();

      const page2 = await listMembers(db as never, systemId, auth, {
        cursor: lastItemId,
        limit: 2,
      });
      expect(page2.items).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });
  });

  describe("updateMember", () => {
    it("increments version on successful update", async () => {
      const created = await createMember(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const updated = await updateMember(
        db as never,
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      expect(updated.version).toBe(2);
    });

    it("throws CONFLICT on stale version", async () => {
      const created = await createMember(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await updateMember(
        db as never,
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      await assertApiError(
        updateMember(
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

  describe("archiveMember", () => {
    it("archives a member so getMember returns NOT_FOUND", async () => {
      const created = await createMember(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveMember(db as never, systemId, created.id, auth, noopAudit);

      await assertApiError(getMember(db as never, systemId, created.id, auth), "NOT_FOUND", 404);
    });
  });

  describe("restoreMember", () => {
    it("restores an archived member", async () => {
      const created = await createMember(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveMember(db as never, systemId, created.id, auth, noopAudit);
      const restored = await restoreMember(db as never, systemId, created.id, auth, noopAudit);

      expect(restored.archived).toBe(false);
      expect(restored.archivedAt).toBeNull();
      expect(restored.id).toBe(created.id);
    });
  });

  describe("deleteMember", () => {
    it("removes the member so getMember returns NOT_FOUND", async () => {
      const created = await createMember(
        db as never,
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await deleteMember(db as never, systemId, created.id, auth, noopAudit);

      await assertApiError(getMember(db as never, systemId, created.id, auth), "NOT_FOUND", 404);
    });
  });
});
