import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { ArchivableEntityConfig, DeletableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { EncryptedBase64, NoteId, SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  serializeEncryptedBlob: vi.fn(() => new Uint8Array([1, 2, 3])),
  deserializeEncryptedBlob: vi.fn((data: Uint8Array) => ({
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
    nonce: new Uint8Array(24),
    ciphertext: new Uint8Array(data.slice(32)),
  })),
  InvalidInputError: class InvalidInputError extends Error {
    override readonly name = "InvalidInputError" as const;
  },
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/entity-lifecycle.js", () => ({
  archiveEntity: vi.fn().mockResolvedValue(undefined),
  deleteEntity: vi.fn().mockResolvedValue(undefined),
  restoreEntity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

vi.mock("@pluralscape/db/pg", () => ({
  notes: {
    id: "id",
    systemId: "system_id",
    authorEntityType: "author_entity_type",
    authorEntityId: "author_entity_id",
    encryptedData: "encrypted_data" as EncryptedBase64,
    version: "version",
    archived: "archived",
    archivedAt: "archived_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  systems: {
    id: "id",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("nt_test-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    count: vi.fn(() => "count(*)"),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    lt: vi.fn((a: unknown, b: unknown) => ["lt", a, b]),
    or: vi.fn((...args: unknown[]) => args),
    isNull: vi.fn((a: unknown) => ["isNull", a]),
    desc: vi.fn((a: unknown) => ["desc", a]),
    sql: Object.assign(vi.fn(), { join: vi.fn() }),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { archiveEntity, deleteEntity, restoreEntity } =
  await import("../../lib/entity-lifecycle.js");

const { createNote } = await import("../../services/note/create.js");
const { getNote, listNotes } = await import("../../services/note/queries.js");
const { updateNote } = await import("../../services/note/update.js");
const { deleteNote, archiveNote, restoreNote } = await import("../../services/note/lifecycle.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const NOTE_ID = brandId<NoteId>("nt_test-note");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeNoteRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: NOTE_ID,
    systemId: SYSTEM_ID,
    authorEntityType: null,
    authorEntityId: null,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("note service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── createNote ─────────────────────────────────────────────────

  describe("createNote", () => {
    const validPayload = { encryptedData: VALID_BLOB_BASE64 };

    it("creates a note and returns result", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeNoteRow()]);

      const result = await createNote(db, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(NOTE_ID);
      expect(result.authorEntityType).toBeNull();
      expect(chain.transaction).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "note.created" }),
      );
    });

    it("creates a note with author when provided", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([
        makeNoteRow({ authorEntityType: "member", authorEntityId: "mem_123" }),
      ]);

      const result = await createNote(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, author: { entityType: "member", entityId: "mem_123" } },
        AUTH,
        mockAudit,
      );

      expect(result.authorEntityType).toBe("member");
      expect(result.authorEntityId).toBe("mem_123");
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();

      await expect(createNote(db, SYSTEM_ID, { bad: true }, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
      );
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(createNote(db, SYSTEM_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws QUOTA_EXCEEDED when note count is at maximum", async () => {
      const { db, chain } = mockDb();
      chain.where
        .mockReturnValueOnce(chain) // quota FOR UPDATE lock -> chains to .for()
        .mockResolvedValueOnce([{ count: 5000 }]); // quota count -> at limit

      await expect(createNote(db, SYSTEM_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 429, code: "QUOTA_EXCEEDED" }),
      );
    });

    it("allows creation when note count is below maximum", async () => {
      const { db, chain } = mockDb();
      chain.where
        .mockReturnValueOnce(chain) // quota FOR UPDATE lock -> chains to .for()
        .mockResolvedValueOnce([{ count: 4999 }]); // quota count -> below limit
      chain.returning.mockResolvedValueOnce([makeNoteRow()]);

      const result = await createNote(db, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(NOTE_ID);
    });

    it("acquires FOR UPDATE lock on system row during quota check", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeNoteRow()]);

      await createNote(db, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(chain.for).toHaveBeenCalledWith("update");
    });
  });

  // ── getNote ────────────────────────────────────────────────────

  describe("getNote", () => {
    it("returns note when found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeNoteRow()]);

      const result = await getNote(db, SYSTEM_ID, NOTE_ID, AUTH);

      expect(result.id).toBe(NOTE_ID);
      expect(result.systemId).toBe(SYSTEM_ID);
    });

    it("throws 404 when note not found", async () => {
      const { db } = mockDb();

      await expect(getNote(db, SYSTEM_ID, NOTE_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(getNote(db, SYSTEM_ID, NOTE_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── listNotes ──────────────────────────────────────────────────

  describe("listNotes", () => {
    it("returns paginated notes", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeNoteRow()]);

      const result = await listNotes(db, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it("returns empty list when no notes exist", async () => {
      const { db } = mockDb();

      const result = await listNotes(db, SYSTEM_ID, AUTH);

      expect(result.data).toEqual([]);
    });

    it("throws VALIDATION_ERROR when systemWide combined with author filters", async () => {
      const { db } = mockDb();

      await expect(
        listNotes(db, SYSTEM_ID, AUTH, { systemWide: true, authorEntityType: "member" }),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("applies authorEntityType filter when provided", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeNoteRow({ authorEntityType: "member" })]);

      const result = await listNotes(db, SYSTEM_ID, AUTH, { authorEntityType: "member" });

      expect(result.data[0]?.authorEntityType).toBe("member");
    });

    it("detects hasMore when more rows exist than limit", async () => {
      const { db, chain } = mockDb();
      const rows = [makeNoteRow({ id: "nt_a" }), makeNoteRow({ id: "nt_b" })];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listNotes(db, SYSTEM_ID, AUTH, { limit: 1 });

      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  // ── updateNote ─────────────────────────────────────────────────

  describe("updateNote", () => {
    const validUpdate = { encryptedData: VALID_BLOB_BASE64, version: 1 };

    it("updates note and returns result", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeNoteRow({ version: 2 })]);

      const result = await updateNote(db, SYSTEM_ID, NOTE_ID, validUpdate, AUTH, mockAudit);

      expect(result.version).toBe(2);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "note.updated" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();

      await expect(
        updateNote(db, SYSTEM_ID, NOTE_ID, { bad: true }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("throws CONFLICT on OCC version mismatch", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ id: NOTE_ID }]);

      await expect(
        updateNote(db, SYSTEM_ID, NOTE_ID, validUpdate, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("throws NOT_FOUND when note does not exist", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        updateNote(db, SYSTEM_ID, NOTE_ID, validUpdate, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── deleteNote ─────────────────────────────────────────────────

  describe("deleteNote", () => {
    it("delegates to deleteEntity with correct config", async () => {
      const { db } = mockDb();
      vi.mocked(deleteEntity).mockResolvedValueOnce(undefined);

      await deleteNote(db, SYSTEM_ID, NOTE_ID, AUTH, mockAudit);

      expect(deleteEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        NOTE_ID,
        AUTH,
        mockAudit,
        expect.objectContaining<Partial<DeletableEntityConfig<string>>>({
          entityName: "Note",
          deleteEvent: "note.deleted",
        }),
      );
    });
  });

  // ── archiveNote ────────────────────────────────────────────────

  describe("archiveNote", () => {
    it("delegates to archiveEntity with correct config", async () => {
      const { db } = mockDb();
      vi.mocked(archiveEntity).mockResolvedValueOnce(undefined);

      await archiveNote(db, SYSTEM_ID, NOTE_ID, AUTH, mockAudit);

      expect(archiveEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        NOTE_ID,
        AUTH,
        mockAudit,
        expect.objectContaining<Partial<ArchivableEntityConfig<string>>>({
          entityName: "Note",
          archiveEvent: "note.archived",
          restoreEvent: "note.restored",
        }),
      );
    });
  });

  // ── restoreNote ────────────────────────────────────────────────

  describe("restoreNote", () => {
    it("delegates to restoreEntity and maps the row", async () => {
      const { db } = mockDb();
      const row = makeNoteRow({ version: 3, authorEntityType: "member" });

      vi.mocked(restoreEntity).mockImplementationOnce(
        async (_db, _sId, _eid, _auth, _audit, _cfg, toResult) => Promise.resolve(toResult(row)),
      );

      const result = await restoreNote(db, SYSTEM_ID, NOTE_ID, AUTH, mockAudit);

      expect(result.id).toBe(NOTE_ID);
      expect(result.version).toBe(3);
      expect(result.authorEntityType).toBe("member");
    });
  });
});
