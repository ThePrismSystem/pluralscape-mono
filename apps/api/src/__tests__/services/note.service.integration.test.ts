import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgCommunicationTables,
  pgInsertAccount,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createNote } from "../../services/note/create.js";
import { archiveNote, deleteNote, restoreNote } from "../../services/note/lifecycle.js";
import { getNote, listNotes } from "../../services/note/queries.js";
import { updateNote } from "../../services/note/update.js";
import { expectSingleAuditEvent } from "../helpers/audit-assertions.js";
import {
  assertApiError,
  asDb,
  genNoteId,
  makeAuth,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { notes } = schema;

describe("note.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgCommunicationTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(notes);
  });

  // ── CREATE ──────────────────────────────────────────────────────

  describe("createNote", () => {
    it("creates a system-wide note (null author) and returns expected shape", async () => {
      const audit = spyAudit();
      const result = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        audit,
      );

      expect(result.id).toMatch(/^note_/);
      expect(result.systemId).toBe(systemId);
      expect(result.authorEntityType).toBeNull();
      expect(result.authorEntityId).toBeNull();
      expect(result.version).toBe(1);
      expect(result.archived).toBe(false);
      expect(result.archivedAt).toBeNull();
      expect(result.encryptedData).toEqual(expect.any(String));
      expect(result.createdAt).toEqual(expect.any(Number));
      expect(result.updatedAt).toEqual(expect.any(Number));
      expectSingleAuditEvent(audit, "note.created");
    });

    it("creates a member-bound note (authorEntityType=member)", async () => {
      const result = await createNote(
        asDb(db),
        systemId,
        {
          encryptedData: testEncryptedDataBase64(),
          author: { entityType: "member", entityId: "mem_test-member" },
        },
        auth,
        noopAudit,
      );

      expect(result.authorEntityType).toBe("member");
      expect(result.authorEntityId).toBe("mem_test-member");
    });

    it("creates a structure-entity-bound note", async () => {
      const result = await createNote(
        asDb(db),
        systemId,
        {
          encryptedData: testEncryptedDataBase64(),
          author: { entityType: "structure-entity", entityId: "ste_test-entity" },
        },
        auth,
        noopAudit,
      );

      expect(result.authorEntityType).toBe("structure-entity");
      expect(result.authorEntityId).toBe("ste_test-entity");
    });

    it("writes audit event note.created", async () => {
      const audit = spyAudit();
      await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        audit,
      );

      expectSingleAuditEvent(audit, "note.created");
    });
  });

  // ── GET ─────────────────────────────────────────────────────────

  describe("getNote", () => {
    it("retrieves a created note", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const result = await getNote(asDb(db), systemId, created.id, auth);
      expect(result.id).toBe(created.id);
      expect(result.systemId).toBe(systemId);
    });

    it("returns NOT_FOUND for nonexistent ID", async () => {
      await assertApiError(getNote(asDb(db), systemId, genNoteId(), auth), "NOT_FOUND", 404);
    });

    it("returns NOT_FOUND for archived note", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveNote(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(getNote(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
    });
  });

  // ── LIST ────────────────────────────────────────────────────────

  describe("listNotes", () => {
    it("lists all non-archived notes", async () => {
      await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const result = await listNotes(asDb(db), systemId, auth);
      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("supports cursor pagination (newest first)", async () => {
      for (let i = 0; i < 3; i++) {
        await createNote(
          asDb(db),
          systemId,
          { encryptedData: testEncryptedDataBase64() },
          auth,
          noopAudit,
        );
      }

      const page1 = await listNotes(asDb(db), systemId, auth, { limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await listNotes(asDb(db), systemId, auth, {
        cursor: page1.nextCursor ?? undefined,
        limit: 2,
      });
      expect(page2.data).toHaveLength(1);
      expect(page2.hasMore).toBe(false);

      const allIds = [...page1.data.map((n) => n.id), ...page2.data.map((n) => n.id)];
      expect(new Set(allIds).size).toBe(3);
    });

    it("filters by authorEntityType", async () => {
      await createNote(
        asDb(db),
        systemId,
        {
          encryptedData: testEncryptedDataBase64(),
          author: { entityType: "member", entityId: "mem_a" },
        },
        auth,
        noopAudit,
      );
      await createNote(
        asDb(db),
        systemId,
        {
          encryptedData: testEncryptedDataBase64(),
          author: { entityType: "structure-entity", entityId: "ste_b" },
        },
        auth,
        noopAudit,
      );

      const result = await listNotes(asDb(db), systemId, auth, {
        authorEntityType: "member",
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.authorEntityType).toBe("member");
    });

    it("filters by authorEntityId", async () => {
      await createNote(
        asDb(db),
        systemId,
        {
          encryptedData: testEncryptedDataBase64(),
          author: { entityType: "member", entityId: "mem_target" },
        },
        auth,
        noopAudit,
      );
      await createNote(
        asDb(db),
        systemId,
        {
          encryptedData: testEncryptedDataBase64(),
          author: { entityType: "member", entityId: "mem_other" },
        },
        auth,
        noopAudit,
      );

      const result = await listNotes(asDb(db), systemId, auth, {
        authorEntityId: "mem_target",
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.authorEntityId).toBe("mem_target");
    });

    it("filters systemWide=true (null author only)", async () => {
      await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );
      await createNote(
        asDb(db),
        systemId,
        {
          encryptedData: testEncryptedDataBase64(),
          author: { entityType: "member", entityId: "mem_x" },
        },
        auth,
        noopAudit,
      );

      const result = await listNotes(asDb(db), systemId, auth, { systemWide: true });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.authorEntityType).toBeNull();
    });

    it("includes archived when includeArchived=true", async () => {
      const note = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveNote(asDb(db), systemId, note.id, auth, noopAudit);

      const result = await listNotes(asDb(db), systemId, auth, { includeArchived: true });
      expect(result.data.some((item) => item.id === note.id)).toBe(true);
    });

    it("returns empty list when no notes", async () => {
      const result = await listNotes(asDb(db), systemId, auth);
      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("respects limit", async () => {
      for (let i = 0; i < 5; i++) {
        await createNote(
          asDb(db),
          systemId,
          { encryptedData: testEncryptedDataBase64() },
          auth,
          noopAudit,
        );
      }

      const result = await listNotes(asDb(db), systemId, auth, { limit: 3 });
      expect(result.data).toHaveLength(3);
      expect(result.hasMore).toBe(true);
    });

    it("rejects systemWide combined with authorEntityType", async () => {
      await assertApiError(
        listNotes(asDb(db), systemId, auth, {
          systemWide: true,
          authorEntityType: "member",
        }),
        "VALIDATION_ERROR",
        400,
      );
    });
  });

  // ── UPDATE ──────────────────────────────────────────────────────

  describe("updateNote", () => {
    it("updates encryptedData with OCC version check", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      const result = await updateNote(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        audit,
      );

      expect(result.version).toBe(2);
      expect(audit.calls[0]?.eventType).toBe("note.updated");
    });

    it("returns CONFLICT on version mismatch", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await updateNote(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        noopAudit,
      );

      await assertApiError(
        updateNote(
          asDb(db),
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

    it("returns NOT_FOUND for nonexistent note", async () => {
      await assertApiError(
        updateNote(
          asDb(db),
          systemId,
          genNoteId(),
          { encryptedData: testEncryptedDataBase64(), version: 1 },
          auth,
          noopAudit,
        ),
        "NOT_FOUND",
        404,
      );
    });

    it("writes audit event note.updated", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await updateNote(
        asDb(db),
        systemId,
        created.id,
        { encryptedData: testEncryptedDataBase64(), version: 1 },
        auth,
        audit,
      );

      expectSingleAuditEvent(audit, "note.updated");
    });
  });

  // ── DELETE ──────────────────────────────────────────────────────

  describe("deleteNote", () => {
    it("deletes note", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await deleteNote(asDb(db), systemId, created.id, auth, audit);
      await assertApiError(getNote(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
      expect(audit.calls[0]?.eventType).toBe("note.deleted");
    });

    it("returns NOT_FOUND for nonexistent note", async () => {
      await assertApiError(
        deleteNote(asDb(db), systemId, genNoteId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("writes audit event note.deleted", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await deleteNote(asDb(db), systemId, created.id, auth, audit);

      expectSingleAuditEvent(audit, "note.deleted");
    });
  });

  // ── CROSS-SYSTEM ISOLATION ──────────────────────────────────────

  describe("cross-system isolation", () => {
    it("cannot access another system's note by ID", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
      const otherAuth = makeAuth(accountId, otherSystemId);

      await assertApiError(
        getNote(asDb(db), otherSystemId, created.id, otherAuth),
        "NOT_FOUND",
        404,
      );
    });

    it("list does not return another system's notes", async () => {
      await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
      const otherAuth = makeAuth(accountId, otherSystemId);

      const result = await listNotes(asDb(db), otherSystemId, otherAuth);
      expect(result.data).toHaveLength(0);
    });
  });

  // ── ARCHIVE / RESTORE ──────────────────────────────────────────

  describe("archiveNote", () => {
    it("archives active note", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await archiveNote(asDb(db), systemId, created.id, auth, audit);
      await assertApiError(getNote(asDb(db), systemId, created.id, auth), "NOT_FOUND", 404);
      expect(audit.calls[0]?.eventType).toBe("note.archived");
    });

    it("returns ALREADY_ARCHIVED", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveNote(asDb(db), systemId, created.id, auth, noopAudit);

      await assertApiError(
        archiveNote(asDb(db), systemId, created.id, auth, noopAudit),
        "ALREADY_ARCHIVED",
        409,
      );
    });

    it("returns NOT_FOUND for nonexistent", async () => {
      await assertApiError(
        archiveNote(asDb(db), systemId, genNoteId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("writes audit event note.archived", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      const audit = spyAudit();
      await archiveNote(asDb(db), systemId, created.id, auth, audit);

      expectSingleAuditEvent(audit, "note.archived");
    });
  });

  describe("restoreNote", () => {
    it("restores archived note", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveNote(asDb(db), systemId, created.id, auth, noopAudit);
      const audit = spyAudit();
      const restored = await restoreNote(asDb(db), systemId, created.id, auth, audit);

      expect(restored.archived).toBe(false);
      expect(restored.archivedAt).toBeNull();
      expect(restored.id).toBe(created.id);
      expect(restored.version).toBe(3);
      expectSingleAuditEvent(audit, "note.restored");
    });

    it("returns NOT_ARCHIVED for active note", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await assertApiError(
        restoreNote(asDb(db), systemId, created.id, auth, noopAudit),
        "NOT_ARCHIVED",
        409,
      );
    });

    it("returns NOT_FOUND for nonexistent", async () => {
      await assertApiError(
        restoreNote(asDb(db), systemId, genNoteId(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("writes audit event note.restored", async () => {
      const created = await createNote(
        asDb(db),
        systemId,
        { encryptedData: testEncryptedDataBase64() },
        auth,
        noopAudit,
      );

      await archiveNote(asDb(db), systemId, created.id, auth, noopAudit);
      const audit = spyAudit();
      await restoreNote(asDb(db), systemId, created.id, auth, audit);

      expectSingleAuditEvent(audit, "note.restored");
    });
  });
});
