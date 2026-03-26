import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { ArchivableEntityConfig, DeletableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { BoardMessageId, SystemId } from "@pluralscape/types";

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
  boardMessages: {
    id: "id",
    systemId: "system_id",
    pinned: "pinned",
    sortOrder: "sort_order",
    encryptedData: "encrypted_data",
    version: "version",
    archived: "archived",
    archivedAt: "archived_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("bm_test-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    gt: vi.fn((a: unknown, b: unknown) => ["gt", a, b]),
    or: vi.fn((...args: unknown[]) => args),
    inArray: vi.fn((col: unknown, arr: unknown) => ["inArray", col, arr]),
    sql: Object.assign(vi.fn(), { join: vi.fn() }),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { archiveEntity, deleteEntity, restoreEntity } =
  await import("../../lib/entity-lifecycle.js");

const {
  createBoardMessage,
  listBoardMessages,
  getBoardMessage,
  updateBoardMessage,
  pinBoardMessage,
  unpinBoardMessage,
  reorderBoardMessages,
  deleteBoardMessage,
  archiveBoardMessage,
  restoreBoardMessage,
} = await import("../../services/board-message.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const BM_ID = "bm_test-board-message" as BoardMessageId;
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeBoardMessageRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: BM_ID,
    systemId: SYSTEM_ID,
    pinned: false,
    sortOrder: 0,
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

describe("board-message service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── createBoardMessage ─────────────────────────────────────────

  describe("createBoardMessage", () => {
    const validPayload = { encryptedData: VALID_BLOB_BASE64, sortOrder: 0 };

    it("creates a board message and returns result", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeBoardMessageRow()]);

      const result = await createBoardMessage(db, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(BM_ID);
      expect(result.pinned).toBe(false);
      expect(chain.transaction).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "board-message.created" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();

      await expect(
        createBoardMessage(db, SYSTEM_ID, { bad: true }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        createBoardMessage(db, SYSTEM_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── listBoardMessages ──────────────────────────────────────────

  describe("listBoardMessages", () => {
    it("returns paginated board messages", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeBoardMessageRow()]);

      const result = await listBoardMessages(db, SYSTEM_ID, AUTH);

      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it("returns empty list when no messages exist", async () => {
      const { db } = mockDb();

      const result = await listBoardMessages(db, SYSTEM_ID, AUTH);

      expect(result.items).toEqual([]);
    });

    it("detects hasMore when more rows exist than limit", async () => {
      const { db, chain } = mockDb();
      const rows = [makeBoardMessageRow({ id: "bm_a" }), makeBoardMessageRow({ id: "bm_b" })];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listBoardMessages(db, SYSTEM_ID, AUTH, { limit: 1 });

      expect(result.hasMore).toBe(true);
      expect(result.items).toHaveLength(1);
    });

    it("applies pinned filter when provided", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeBoardMessageRow({ pinned: true })]);

      const result = await listBoardMessages(db, SYSTEM_ID, AUTH, { pinned: true });

      expect(result.items[0]?.pinned).toBe(true);
    });
  });

  // ── getBoardMessage ────────────────────────────────────────────

  describe("getBoardMessage", () => {
    it("returns board message when found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeBoardMessageRow()]);

      const result = await getBoardMessage(db, SYSTEM_ID, BM_ID, AUTH);

      expect(result.id).toBe(BM_ID);
    });

    it("throws 404 when board message not found", async () => {
      const { db } = mockDb();

      await expect(getBoardMessage(db, SYSTEM_ID, BM_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── updateBoardMessage ─────────────────────────────────────────

  describe("updateBoardMessage", () => {
    const validUpdate = { encryptedData: VALID_BLOB_BASE64, version: 1 };

    it("updates board message and returns result", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeBoardMessageRow({ version: 2 })]);

      const result = await updateBoardMessage(db, SYSTEM_ID, BM_ID, validUpdate, AUTH, mockAudit);

      expect(result.version).toBe(2);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "board-message.updated" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();

      await expect(
        updateBoardMessage(db, SYSTEM_ID, BM_ID, { bad: true }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("throws CONFLICT on OCC version mismatch", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ id: BM_ID }]);

      await expect(
        updateBoardMessage(db, SYSTEM_ID, BM_ID, validUpdate, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("throws NOT_FOUND when board message does not exist", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        updateBoardMessage(db, SYSTEM_ID, BM_ID, validUpdate, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── pinBoardMessage ────────────────────────────────────────────

  describe("pinBoardMessage", () => {
    it("pins a board message successfully", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeBoardMessageRow({ pinned: true })]);

      const result = await pinBoardMessage(db, SYSTEM_ID, BM_ID, AUTH, mockAudit);

      expect(result.pinned).toBe(true);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "board-message.pinned" }),
      );
    });

    it("throws NOT_FOUND when board message not found", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([]); // not found

      await expect(pinBoardMessage(db, SYSTEM_ID, BM_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws ALREADY_PINNED when already pinned", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ id: BM_ID, pinned: true, archived: false }]);

      await expect(pinBoardMessage(db, SYSTEM_ID, BM_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "ALREADY_PINNED" }),
      );
    });

    it("throws ALREADY_ARCHIVED when board message is archived", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ id: BM_ID, pinned: false, archived: true }]);

      await expect(pinBoardMessage(db, SYSTEM_ID, BM_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "ALREADY_ARCHIVED" }),
      );
    });
  });

  // ── unpinBoardMessage ──────────────────────────────────────────

  describe("unpinBoardMessage", () => {
    it("unpins a board message successfully", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeBoardMessageRow({ pinned: false })]);

      const result = await unpinBoardMessage(db, SYSTEM_ID, BM_ID, AUTH, mockAudit);

      expect(result.pinned).toBe(false);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "board-message.unpinned" }),
      );
    });

    it("throws NOT_PINNED when not pinned", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ id: BM_ID, pinned: false, archived: false }]);

      await expect(unpinBoardMessage(db, SYSTEM_ID, BM_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "NOT_PINNED" }),
      );
    });
  });

  // ── reorderBoardMessages ───────────────────────────────────────

  describe("reorderBoardMessages", () => {
    it("reorders board messages successfully", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ id: BM_ID }]);

      await reorderBoardMessages(
        db,
        SYSTEM_ID,
        { operations: [{ boardMessageId: BM_ID, sortOrder: 5 }] },
        AUTH,
        mockAudit,
      );

      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "board-message.reordered" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();

      await expect(
        reorderBoardMessages(db, SYSTEM_ID, { bad: true }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("throws VALIDATION_ERROR for duplicate board message IDs", async () => {
      const { db } = mockDb();

      await expect(
        reorderBoardMessages(
          db,
          SYSTEM_ID,
          {
            operations: [
              { boardMessageId: BM_ID, sortOrder: 1 },
              { boardMessageId: BM_ID, sortOrder: 2 },
            ],
          },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("throws NOT_FOUND when some board messages not found", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]); // no rows updated

      await expect(
        reorderBoardMessages(
          db,
          SYSTEM_ID,
          { operations: [{ boardMessageId: BM_ID, sortOrder: 1 }] },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── deleteBoardMessage ─────────────────────────────────────────

  describe("deleteBoardMessage", () => {
    it("delegates to deleteEntity with correct config", async () => {
      const { db } = mockDb();
      vi.mocked(deleteEntity).mockResolvedValueOnce(undefined);

      await deleteBoardMessage(db, SYSTEM_ID, BM_ID, AUTH, mockAudit);

      expect(deleteEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        BM_ID,
        AUTH,
        mockAudit,
        expect.objectContaining<Partial<DeletableEntityConfig<string>>>({
          entityName: "Board message",
          deleteEvent: "board-message.deleted",
        }),
      );
    });
  });

  // ── archiveBoardMessage ────────────────────────────────────────

  describe("archiveBoardMessage", () => {
    it("delegates to archiveEntity with correct config", async () => {
      const { db } = mockDb();
      vi.mocked(archiveEntity).mockResolvedValueOnce(undefined);

      await archiveBoardMessage(db, SYSTEM_ID, BM_ID, AUTH, mockAudit);

      expect(archiveEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        BM_ID,
        AUTH,
        mockAudit,
        expect.objectContaining<Partial<ArchivableEntityConfig<string>>>({
          entityName: "Board message",
          archiveEvent: "board-message.archived",
          restoreEvent: "board-message.restored",
        }),
      );
    });
  });

  // ── restoreBoardMessage ────────────────────────────────────────

  describe("restoreBoardMessage", () => {
    it("delegates to restoreEntity and maps the row", async () => {
      const { db } = mockDb();
      const row = makeBoardMessageRow({ version: 4, pinned: true });

      vi.mocked(restoreEntity).mockImplementationOnce(
        async (_db, _sId, _eid, _auth, _audit, _cfg, toResult) => Promise.resolve(toResult(row)),
      );

      const result = await restoreBoardMessage(db, SYSTEM_ID, BM_ID, AUTH, mockAudit);

      expect(result.id).toBe(BM_ID);
      expect(result.version).toBe(4);
      expect(result.pinned).toBe(true);
    });
  });
});
