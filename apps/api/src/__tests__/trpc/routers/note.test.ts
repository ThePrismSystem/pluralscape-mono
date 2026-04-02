import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { NoteId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/note.service.js", () => ({
  createNote: vi.fn(),
  getNote: vi.fn(),
  listNotes: vi.fn(),
  updateNote: vi.fn(),
  archiveNote: vi.fn(),
  restoreNote: vi.fn(),
  deleteNote: vi.fn(),
}));

const { createNote, getNote, listNotes, updateNote, archiveNote, restoreNote, deleteNote } =
  await import("../../../services/note.service.js");

const { noteRouter } = await import("../../../trpc/routers/note.js");

const createCaller = makeCallerFactory({ note: noteRouter });

const NOTE_ID = "note_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as NoteId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3Jub3Rl";

const MOCK_NOTE_RESULT = {
  id: NOTE_ID,
  systemId: MOCK_SYSTEM_ID,
  authorEntityType: null,
  authorEntityId: null,
  encryptedData: "base64data==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("note router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("note.create", () => {
    it("calls createNote with correct systemId and returns result", async () => {
      vi.mocked(createNote).mockResolvedValue(MOCK_NOTE_RESULT);
      const caller = createCaller();
      const result = await caller.note.create({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(createNote)).toHaveBeenCalledOnce();
      expect(vi.mocked(createNote).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_NOTE_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.note.create({ systemId: MOCK_SYSTEM_ID, encryptedData: VALID_ENCRYPTED_DATA }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(
        caller.note.create({ systemId: foreignSystemId, encryptedData: VALID_ENCRYPTED_DATA }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("note.get", () => {
    it("calls getNote with correct systemId and noteId", async () => {
      vi.mocked(getNote).mockResolvedValue(MOCK_NOTE_RESULT);
      const caller = createCaller();
      const result = await caller.note.get({ systemId: MOCK_SYSTEM_ID, noteId: NOTE_ID });

      expect(vi.mocked(getNote)).toHaveBeenCalledOnce();
      expect(vi.mocked(getNote).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getNote).mock.calls[0]?.[2]).toBe(NOTE_ID);
      expect(result).toEqual(MOCK_NOTE_RESULT);
    });

    it("rejects invalid noteId format", async () => {
      const caller = createCaller();
      await expect(
        caller.note.get({ systemId: MOCK_SYSTEM_ID, noteId: "invalid-id" as NoteId }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getNote).mockRejectedValue(new ApiHttpError(404, "NOT_FOUND", "Note not found"));
      const caller = createCaller();
      await expect(caller.note.get({ systemId: MOCK_SYSTEM_ID, noteId: NOTE_ID })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("note.list", () => {
    it("calls listNotes and returns result", async () => {
      const mockResult = {
        data: [MOCK_NOTE_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listNotes).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.note.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listNotes)).toHaveBeenCalledOnce();
      expect(vi.mocked(listNotes).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, and includeArchived as opts", async () => {
      vi.mocked(listNotes).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.note.list({
        systemId: MOCK_SYSTEM_ID,
        cursor: "cur_abc",
        limit: 10,
        includeArchived: true,
      });

      const opts = vi.mocked(listNotes).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("cur_abc");
      expect(opts?.limit).toBe(10);
      expect(opts?.includeArchived).toBe(true);
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("note.update", () => {
    it("calls updateNote with correct systemId and noteId", async () => {
      vi.mocked(updateNote).mockResolvedValue(MOCK_NOTE_RESULT);
      const caller = createCaller();
      const result = await caller.note.update({
        systemId: MOCK_SYSTEM_ID,
        noteId: NOTE_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateNote)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateNote).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(updateNote).mock.calls[0]?.[2]).toBe(NOTE_ID);
      expect(result).toEqual(MOCK_NOTE_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateNote).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.note.update({
          systemId: MOCK_SYSTEM_ID,
          noteId: NOTE_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("note.archive", () => {
    it("calls archiveNote and returns success", async () => {
      vi.mocked(archiveNote).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.note.archive({ systemId: MOCK_SYSTEM_ID, noteId: NOTE_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveNote)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveNote).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(archiveNote).mock.calls[0]?.[2]).toBe(NOTE_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveNote).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Note not found"),
      );
      const caller = createCaller();
      await expect(
        caller.note.archive({ systemId: MOCK_SYSTEM_ID, noteId: NOTE_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("note.restore", () => {
    it("calls restoreNote and returns the note result", async () => {
      vi.mocked(restoreNote).mockResolvedValue(MOCK_NOTE_RESULT);
      const caller = createCaller();
      const result = await caller.note.restore({ systemId: MOCK_SYSTEM_ID, noteId: NOTE_ID });

      expect(vi.mocked(restoreNote)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreNote).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(restoreNote).mock.calls[0]?.[2]).toBe(NOTE_ID);
      expect(result).toEqual(MOCK_NOTE_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreNote).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Note not found"),
      );
      const caller = createCaller();
      await expect(
        caller.note.restore({ systemId: MOCK_SYSTEM_ID, noteId: NOTE_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("note.delete", () => {
    it("calls deleteNote and returns success", async () => {
      vi.mocked(deleteNote).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.note.delete({ systemId: MOCK_SYSTEM_ID, noteId: NOTE_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteNote)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteNote).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deleteNote).mock.calls[0]?.[2]).toBe(NOTE_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteNote).mockRejectedValue(new ApiHttpError(404, "NOT_FOUND", "Note not found"));
      const caller = createCaller();
      await expect(
        caller.note.delete({ systemId: MOCK_SYSTEM_ID, noteId: NOTE_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listNotes).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.note.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createNote).mockResolvedValue(MOCK_NOTE_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.note.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      "write",
    );
  });
});
