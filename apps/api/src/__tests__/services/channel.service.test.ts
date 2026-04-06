import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { ArchivableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { ChannelId, SystemId } from "@pluralscape/types";

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
    parentId: "parent_id",
    sortOrder: "sort_order",
    encryptedData: "encrypted_data",
    version: "version",
    archived: "archived",
    archivedAt: "archived_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  messages: {
    id: "id",
    systemId: "system_id",
    channelId: "channel_id",
    archived: "archived",
  },
  systems: {
    id: "id",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("ch_test-id"),
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
    count: vi.fn(() => ({ count: "count" })),
    sql: Object.assign(vi.fn(), { join: vi.fn() }),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { archiveEntity, restoreEntity } = await import("../../lib/entity-lifecycle.js");

const {
  createChannel,
  listChannels,
  getChannel,
  updateChannel,
  deleteChannel,
  archiveChannel,
  restoreChannel,
} = await import("../../services/channel.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const CHANNEL_ID = "ch_test-channel" as ChannelId;
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeChannelRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CHANNEL_ID,
    systemId: SYSTEM_ID,
    type: "channel",
    parentId: null,
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

describe("channel service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── createChannel ──────────────────────────────────────────────

  describe("createChannel", () => {
    const validPayload = { encryptedData: VALID_BLOB_BASE64, type: "channel", sortOrder: 0 };

    it("creates a channel and returns result", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeChannelRow()]);

      const result = await createChannel(db, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(CHANNEL_ID);
      expect(result.type).toBe("channel");
      expect(chain.transaction).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "channel.created" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();

      await expect(createChannel(db, SYSTEM_ID, { bad: true }, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
      );
    });

    it("throws INVALID_HIERARCHY when category has a parentId", async () => {
      const { db } = mockDb();

      await expect(
        createChannel(
          db,
          SYSTEM_ID,
          {
            encryptedData: VALID_BLOB_BASE64,
            type: "category",
            sortOrder: 0,
            parentId: "ch_00000000-0000-4000-a000-000000000001",
          },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "INVALID_HIERARCHY" }));
    });

    it("throws NOT_FOUND when parentId does not exist", async () => {
      const { db } = mockDb();
      // chain.limit defaults to [] — parent not found

      await expect(
        createChannel(
          db,
          SYSTEM_ID,
          {
            encryptedData: VALID_BLOB_BASE64,
            type: "channel",
            sortOrder: 0,
            parentId: "ch_00000000-0000-4000-a000-000000000001",
          },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("throws INVALID_HIERARCHY when parent is not a category", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([
        { id: "ch_00000000-0000-4000-a000-000000000001", type: "channel" },
      ]); // parent is a channel

      await expect(
        createChannel(
          db,
          SYSTEM_ID,
          {
            encryptedData: VALID_BLOB_BASE64,
            type: "channel",
            sortOrder: 0,
            parentId: "ch_00000000-0000-4000-a000-000000000001",
          },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "INVALID_HIERARCHY" }));
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(createChannel(db, SYSTEM_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws QUOTA_EXCEEDED when channel count is at maximum", async () => {
      const { db, chain } = mockDb();
      chain.where
        .mockReturnValueOnce(chain) // quota FOR UPDATE lock -> chains to .for()
        .mockResolvedValueOnce([{ count: 50 }]); // quota count -> at limit

      await expect(createChannel(db, SYSTEM_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 429, code: "QUOTA_EXCEEDED" }),
      );
    });
  });

  // ── listChannels ───────────────────────────────────────────────

  describe("listChannels", () => {
    it("returns paginated channels", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeChannelRow()]);

      const result = await listChannels(db, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it("returns empty list when no channels exist", async () => {
      const { db } = mockDb();

      const result = await listChannels(db, SYSTEM_ID, AUTH);

      expect(result.data).toEqual([]);
    });

    it("applies type filter when provided", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await listChannels(db, SYSTEM_ID, AUTH, { type: "category" });

      expect(chain.where).toHaveBeenCalled();
    });

    it("detects hasMore when more rows exist than limit", async () => {
      const { db, chain } = mockDb();
      const rows = [makeChannelRow({ id: "ch_a" }), makeChannelRow({ id: "ch_b" })];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listChannels(db, SYSTEM_ID, AUTH, { limit: 1 });

      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(listChannels(db, SYSTEM_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── getChannel ─────────────────────────────────────────────────

  describe("getChannel", () => {
    it("returns channel when found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeChannelRow()]);

      const result = await getChannel(db, SYSTEM_ID, CHANNEL_ID, AUTH);

      expect(result.id).toBe(CHANNEL_ID);
      expect(result.systemId).toBe(SYSTEM_ID);
    });

    it("throws 404 when channel not found", async () => {
      const { db } = mockDb();

      await expect(getChannel(db, SYSTEM_ID, CHANNEL_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(getChannel(db, SYSTEM_ID, CHANNEL_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── updateChannel ──────────────────────────────────────────────

  describe("updateChannel", () => {
    const validUpdate = { encryptedData: VALID_BLOB_BASE64, version: 1 };

    it("updates channel and returns result", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeChannelRow({ version: 2 })]);

      const result = await updateChannel(db, SYSTEM_ID, CHANNEL_ID, validUpdate, AUTH, mockAudit);

      expect(result.version).toBe(2);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "channel.updated" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();

      await expect(
        updateChannel(db, SYSTEM_ID, CHANNEL_ID, { bad: true }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("throws CONFLICT on OCC version mismatch", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ id: CHANNEL_ID }]); // exists but version mismatch

      await expect(
        updateChannel(db, SYSTEM_ID, CHANNEL_ID, validUpdate, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("throws NOT_FOUND when channel does not exist", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([]); // not found

      await expect(
        updateChannel(db, SYSTEM_ID, CHANNEL_ID, validUpdate, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── deleteChannel ──────────────────────────────────────────────

  describe("deleteChannel", () => {
    it("deletes a channel with no dependents", async () => {
      const { db: freshDb, chain: freshChain } = mockDb();
      freshChain.limit.mockResolvedValueOnce([{ id: CHANNEL_ID }]);

      let whereCount = 0;
      freshChain.where.mockImplementation((): unknown => {
        whereCount++;
        if (whereCount === 2) return Promise.resolve([{ count: 0 }]);
        if (whereCount === 3) return Promise.resolve([{ count: 0 }]);
        return freshChain;
      });

      await deleteChannel(freshDb, SYSTEM_ID, CHANNEL_ID, AUTH, mockAudit);

      expect(mockAudit).toHaveBeenCalledWith(
        freshChain,
        expect.objectContaining({ eventType: "channel.deleted" }),
      );
    });

    it("throws 404 when channel not found", async () => {
      const { db } = mockDb();

      await expect(deleteChannel(db, SYSTEM_ID, CHANNEL_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws HAS_DEPENDENTS when child channels exist", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: CHANNEL_ID }]);

      let whereCount = 0;
      chain.where.mockImplementation((): unknown => {
        whereCount++;
        if (whereCount === 2) return Promise.resolve([{ count: 2 }]); // child channels
        if (whereCount === 3) return Promise.resolve([{ count: 0 }]); // messages
        return chain;
      });

      await expect(deleteChannel(db, SYSTEM_ID, CHANNEL_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "HAS_DEPENDENTS" }),
      );
    });
  });

  // ── archiveChannel ─────────────────────────────────────────────

  describe("archiveChannel", () => {
    it("delegates to archiveEntity with correct config", async () => {
      const { db } = mockDb();
      vi.mocked(archiveEntity).mockResolvedValueOnce(undefined);

      await archiveChannel(db, SYSTEM_ID, CHANNEL_ID, AUTH, mockAudit);

      expect(archiveEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        CHANNEL_ID,
        AUTH,
        mockAudit,
        expect.objectContaining<Partial<ArchivableEntityConfig<string>>>({
          entityName: "Channel",
          archiveEvent: "channel.archived",
          restoreEvent: "channel.restored",
        }),
      );
    });
  });

  // ── restoreChannel ─────────────────────────────────────────────

  describe("restoreChannel", () => {
    it("delegates to restoreEntity with correct config", async () => {
      const { db } = mockDb();
      vi.mocked(restoreEntity).mockResolvedValueOnce(makeChannelRow());

      await restoreChannel(db, SYSTEM_ID, CHANNEL_ID, AUTH, mockAudit);

      expect(restoreEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        CHANNEL_ID,
        AUTH,
        mockAudit,
        expect.objectContaining<Partial<ArchivableEntityConfig<string>>>({
          entityName: "Channel",
          archiveEvent: "channel.archived",
          restoreEvent: "channel.restored",
        }),
        expect.any(Function),
      );
    });

    it("maps the returned row through toChannelResult", async () => {
      const { db } = mockDb();
      const row = makeChannelRow({ version: 5, type: "category" });

      vi.mocked(restoreEntity).mockImplementationOnce(
        async (_db, _sId, _eid, _auth, _audit, _cfg, toResult) => Promise.resolve(toResult(row)),
      );

      const result = await restoreChannel(db, SYSTEM_ID, CHANNEL_ID, AUTH, mockAudit);

      expect(result.id).toBe(CHANNEL_ID);
      expect(result.version).toBe(5);
      expect(result.type).toBe("category");
    });
  });
});
