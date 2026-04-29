import { toUnixMillis, brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { ArchivableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { EncryptedBase64, ChannelId, MessageId, SystemId } from "@pluralscape/types";

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
  restoreEntity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

vi.mock("@pluralscape/db/pg", () => ({
  channels: {
    id: "id",
    systemId: "system_id",
    type: "type",
    archived: "archived",
  },
  messages: {
    id: "id",
    systemId: "system_id",
    channelId: "channel_id",
    replyToId: "reply_to_id",
    timestamp: "timestamp",
    editedAt: "edited_at",
    encryptedData: "encrypted_data" as EncryptedBase64,
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
    createId: vi.fn().mockReturnValue("msg_test-id"),
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
    lt: vi.fn((a: unknown, b: unknown) => ["lt", a, b]),
    or: vi.fn((...args: unknown[]) => args),
    sql: Object.assign(vi.fn(), { join: vi.fn() }),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { archiveEntity, restoreEntity } = await import("../../lib/entity-lifecycle.js");

const { createMessage } = await import("../../services/message/create.js");
const { listMessages, getMessage } = await import("../../services/message/queries.js");
const { updateMessage } = await import("../../services/message/update.js");
const { deleteMessage } = await import("../../services/message/delete.js");
const { archiveMessage, restoreMessage } = await import("../../services/message/lifecycle.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const CHANNEL_ID = brandId<ChannelId>("ch_test-channel");
const MESSAGE_ID = brandId<MessageId>("msg_test-message");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeMessageRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: MESSAGE_ID,
    channelId: CHANNEL_ID,
    systemId: SYSTEM_ID,
    replyToId: null,
    timestamp: 1000,
    editedAt: null,
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

describe("message service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── createMessage ──────────────────────────────────────────────

  describe("createMessage", () => {
    const validPayload = {
      encryptedData: VALID_BLOB_BASE64,
      timestamp: 1000,
      replyToId: undefined,
    };

    it("creates a message and returns result", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: CHANNEL_ID }]); // channel exists
      chain.returning.mockResolvedValueOnce([makeMessageRow()]);

      const result = await createMessage(db, SYSTEM_ID, CHANNEL_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(MESSAGE_ID);
      expect(result.channelId).toBe(CHANNEL_ID);
      expect(chain.transaction).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "message.created" }),
      );
    });

    it("throws NOT_FOUND when channel does not exist", async () => {
      const { db } = mockDb();
      // chain.limit defaults to [] so channel lookup returns nothing

      await expect(
        createMessage(db, SYSTEM_ID, CHANNEL_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        createMessage(db, SYSTEM_ID, CHANNEL_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── listMessages ───────────────────────────────────────────────

  describe("listMessages", () => {
    it("returns paginated messages", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeMessageRow()]);

      const result = await listMessages(db, SYSTEM_ID, CHANNEL_ID, AUTH);

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it("returns empty list when no messages exist", async () => {
      const { db } = mockDb();

      const result = await listMessages(db, SYSTEM_ID, CHANNEL_ID, AUTH);

      expect(result.data).toEqual([]);
    });

    it("detects hasMore when more rows exist than limit", async () => {
      const { db, chain } = mockDb();
      const rows = [makeMessageRow({ id: "msg_a" }), makeMessageRow({ id: "msg_b" })];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listMessages(db, SYSTEM_ID, CHANNEL_ID, AUTH, { limit: 1 });

      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("applies timestamp filters when provided", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await listMessages(db, SYSTEM_ID, CHANNEL_ID, AUTH, {
        before: toUnixMillis(2000),
        after: toUnixMillis(500),
      });

      expect(chain.where).toHaveBeenCalled();
    });
  });

  // ── getMessage ─────────────────────────────────────────────────

  describe("getMessage", () => {
    it("returns message when found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeMessageRow()]);

      const result = await getMessage(db, SYSTEM_ID, MESSAGE_ID, AUTH);

      expect(result.id).toBe(MESSAGE_ID);
      expect(result.systemId).toBe(SYSTEM_ID);
    });

    it("throws 404 when message not found", async () => {
      const { db } = mockDb();

      await expect(getMessage(db, SYSTEM_ID, MESSAGE_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(getMessage(db, SYSTEM_ID, MESSAGE_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── updateMessage ──────────────────────────────────────────────

  describe("updateMessage", () => {
    const validUpdate = { encryptedData: VALID_BLOB_BASE64, version: 1 };

    it("updates message and returns result", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeMessageRow({ version: 2 })]);

      const result = await updateMessage(db, SYSTEM_ID, MESSAGE_ID, validUpdate, AUTH, mockAudit);

      expect(result.version).toBe(2);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "message.updated" }),
      );
    });

    it("throws CONFLICT on OCC version mismatch", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ id: MESSAGE_ID }]); // exists

      await expect(
        updateMessage(db, SYSTEM_ID, MESSAGE_ID, validUpdate, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("throws NOT_FOUND when message does not exist", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([]); // not found

      await expect(
        updateMessage(db, SYSTEM_ID, MESSAGE_ID, validUpdate, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── deleteMessage ──────────────────────────────────────────────

  describe("deleteMessage", () => {
    it("deletes message and writes audit", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: MESSAGE_ID, channelId: CHANNEL_ID }]);

      await deleteMessage(db, SYSTEM_ID, MESSAGE_ID, AUTH, mockAudit);

      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "message.deleted" }),
      );
    });

    it("throws 404 when message not found", async () => {
      const { db } = mockDb();

      await expect(deleteMessage(db, SYSTEM_ID, MESSAGE_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(deleteMessage(db, SYSTEM_ID, MESSAGE_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── archiveMessage ─────────────────────────────────────────────

  describe("archiveMessage", () => {
    it("delegates to archiveEntity with correct config", async () => {
      const { db } = mockDb();
      vi.mocked(archiveEntity).mockResolvedValueOnce(undefined);

      await archiveMessage(db, SYSTEM_ID, MESSAGE_ID, AUTH, mockAudit);

      expect(archiveEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        MESSAGE_ID,
        AUTH,
        mockAudit,
        expect.objectContaining<Partial<ArchivableEntityConfig<string>>>({
          entityName: "Message",
          archiveEvent: "message.archived",
          restoreEvent: "message.restored",
        }),
      );
    });
  });

  // ── restoreMessage ─────────────────────────────────────────────

  describe("restoreMessage", () => {
    it("delegates to restoreEntity and maps the row", async () => {
      const { db } = mockDb();
      const row = makeMessageRow({ version: 3 });

      vi.mocked(restoreEntity).mockImplementationOnce(
        async (_db, _sId, _eid, _auth, _audit, _cfg, toResult) => Promise.resolve(toResult(row)),
      );

      const result = await restoreMessage(db, SYSTEM_ID, MESSAGE_ID, AUTH, mockAudit);

      expect(result.id).toBe(MESSAGE_ID);
      expect(result.version).toBe(3);
    });
  });
});
