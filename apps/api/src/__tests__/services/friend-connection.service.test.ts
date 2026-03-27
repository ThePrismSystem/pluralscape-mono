import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { AccountId, FriendConnectionId } from "@pluralscape/types";

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

vi.mock("@pluralscape/db/pg", () => ({
  friendConnections: {
    id: "id",
    accountId: "account_id",
    friendAccountId: "friend_account_id",
    status: "status",
    encryptedData: "encrypted_data",
    version: "version",
    archived: "archived",
    archivedAt: "archived_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  friendBucketAssignments: {
    friendConnectionId: "friend_connection_id",
    bucketId: "bucket_id",
    systemId: "system_id",
  },
  keyGrants: {
    id: "id",
    bucketId: "bucket_id",
    systemId: "system_id",
    friendAccountId: "friend_account_id",
    encryptedKey: "encrypted_key",
    keyVersion: "key_version",
    createdAt: "created_at",
    revokedAt: "revoked_at",
  },
  systems: {
    id: "id",
    accountId: "account_id",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("fc_test-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    lt: vi.fn((a: unknown, b: unknown) => ["lt", a, b]),
    or: vi.fn((...args: unknown[]) => ["or", ...args]),
    desc: vi.fn((a: unknown) => ["desc", a]),
    sql: Object.assign(vi.fn(), { join: vi.fn() }),
    inArray: vi.fn((a: unknown, b: unknown) => ["inArray", a, b]),
    isNull: vi.fn((a: unknown) => ["isNull", a]),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const {
  listFriendConnections,
  getFriendConnection,
  blockFriendConnection,
  removeFriendConnection,
  updateFriendVisibility,
  archiveFriendConnection,
  restoreFriendConnection,
} = await import("../../services/friend-connection.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const ACCOUNT_ID = "acc_test-account" as AccountId;
const FRIEND_ACCOUNT_ID = "acc_test-friend" as AccountId;
const CONNECTION_ID = "fc_test-connection" as FriendConnectionId;
const AUTH = makeTestAuth({ accountId: ACCOUNT_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

function makeConnectionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CONNECTION_ID,
    accountId: ACCOUNT_ID,
    friendAccountId: FRIEND_ACCOUNT_ID,
    status: "accepted",
    encryptedData: null,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("friend-connection service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── listFriendConnections ────────────────────────────────────────

  describe("listFriendConnections", () => {
    it("returns paginated connections", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow()]);

      const result = await listFriendConnections(db, ACCOUNT_ID, AUTH);

      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it("returns empty list when no connections exist", async () => {
      const { db } = mockDb();

      const result = await listFriendConnections(db, ACCOUNT_ID, AUTH);

      expect(result.items).toEqual([]);
    });

    it("detects hasMore when more rows exist than limit", async () => {
      const { db, chain } = mockDb();
      const rows = [makeConnectionRow({ id: "fc_a" }), makeConnectionRow({ id: "fc_b" })];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listFriendConnections(db, ACCOUNT_ID, AUTH, { limit: 1 });

      expect(result.hasMore).toBe(true);
      expect(result.items).toHaveLength(1);
    });

    it("throws 404 when accountId does not match auth", async () => {
      const { db } = mockDb();
      const otherAccountId = "acc_other" as AccountId;

      await expect(listFriendConnections(db, otherAccountId, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── getFriendConnection ──────────────────────────────────────────

  describe("getFriendConnection", () => {
    it("returns connection when found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow()]);

      const result = await getFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH);

      expect(result.id).toBe(CONNECTION_ID);
      expect(result.accountId).toBe(ACCOUNT_ID);
    });

    it("throws 404 when connection not found", async () => {
      const { db } = mockDb();

      await expect(getFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws 404 when accountId does not match auth", async () => {
      const { db } = mockDb();
      const otherAccountId = "acc_other" as AccountId;

      await expect(getFriendConnection(db, otherAccountId, CONNECTION_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── blockFriendConnection ────────────────────────────────────────

  describe("blockFriendConnection", () => {
    it("blocks an accepted connection", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow({ status: "accepted" })]);
      chain.returning.mockResolvedValueOnce([makeConnectionRow({ status: "blocked" })]);
      // Wire bilateral operations: transition SELECT where, UPDATE where,
      // updateReverse where, cleanupBucketAssignments caller SELECT (terminal),
      // reverse conn SELECT where
      chain.where
        .mockReturnValueOnce(chain) // #1 transitionConnectionStatus SELECT
        .mockReturnValueOnce(chain) // #2 transitionConnectionStatus UPDATE
        .mockReturnValueOnce(chain) // #3 updateReverseConnection UPDATE
        .mockResolvedValueOnce([]) // #4 cleanupBucketAssignments caller SELECT
        .mockReturnValueOnce(chain); // #5 reverse conn SELECT (for .limit)

      const result = await blockFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit);

      expect(result.status).toBe("blocked");
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "friend-connection.blocked" }),
      );
    });

    it("throws 409 when already blocked", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow({ status: "blocked" })]);

      await expect(
        blockFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("throws 409 when already removed", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow({ status: "removed" })]);

      await expect(
        blockFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("blocks a pending connection", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow({ status: "pending" })]);
      chain.returning.mockResolvedValueOnce([makeConnectionRow({ status: "blocked" })]);
      chain.where
        .mockReturnValueOnce(chain) // #1 transitionConnectionStatus SELECT
        .mockReturnValueOnce(chain) // #2 transitionConnectionStatus UPDATE
        .mockReturnValueOnce(chain) // #3 updateReverseConnection UPDATE
        .mockResolvedValueOnce([]) // #4 cleanupBucketAssignments caller SELECT
        .mockReturnValueOnce(chain); // #5 reverse conn SELECT (for .limit)

      const result = await blockFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit);

      expect(result.status).toBe("blocked");
    });

    it("throws when update returns no rows after existence check", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow({ status: "accepted" })]);
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        blockFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit),
      ).rejects.toThrow("Failed to blocked friend connection");
    });

    it("throws 404 when connection not found", async () => {
      const { db } = mockDb();

      await expect(
        blockFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── removeFriendConnection ───────────────────────────────────────

  describe("removeFriendConnection", () => {
    it("removes an accepted connection", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow({ status: "accepted" })]);
      chain.returning.mockResolvedValueOnce([makeConnectionRow({ status: "removed" })]);
      // Wire bilateral operations: transition SELECT where, UPDATE where,
      // updateReverse where, cleanupBucketAssignments caller SELECT (terminal),
      // reverse conn SELECT where
      chain.where
        .mockReturnValueOnce(chain) // #1 transitionConnectionStatus SELECT
        .mockReturnValueOnce(chain) // #2 transitionConnectionStatus UPDATE
        .mockReturnValueOnce(chain) // #3 updateReverseConnection UPDATE
        .mockResolvedValueOnce([]) // #4 cleanupBucketAssignments caller SELECT
        .mockReturnValueOnce(chain); // #5 reverse conn SELECT (for .limit)

      const result = await removeFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit);

      expect(result.status).toBe("removed");
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "friend-connection.removed" }),
      );
    });

    it("removes a blocked connection", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow({ status: "blocked" })]);
      chain.returning.mockResolvedValueOnce([makeConnectionRow({ status: "removed" })]);
      chain.where
        .mockReturnValueOnce(chain) // #1 transitionConnectionStatus SELECT
        .mockReturnValueOnce(chain) // #2 transitionConnectionStatus UPDATE
        .mockReturnValueOnce(chain) // #3 updateReverseConnection UPDATE
        .mockResolvedValueOnce([]) // #4 cleanupBucketAssignments caller SELECT
        .mockReturnValueOnce(chain); // #5 reverse conn SELECT (for .limit)

      const result = await removeFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit);

      expect(result.status).toBe("removed");
    });

    it("throws 409 when already removed", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow({ status: "removed" })]);

      await expect(
        removeFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("removes a pending connection", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow({ status: "pending" })]);
      chain.returning.mockResolvedValueOnce([makeConnectionRow({ status: "removed" })]);
      chain.where
        .mockReturnValueOnce(chain) // #1 transitionConnectionStatus SELECT
        .mockReturnValueOnce(chain) // #2 transitionConnectionStatus UPDATE
        .mockReturnValueOnce(chain) // #3 updateReverseConnection UPDATE
        .mockResolvedValueOnce([]) // #4 cleanupBucketAssignments caller SELECT
        .mockReturnValueOnce(chain); // #5 reverse conn SELECT (for .limit)

      const result = await removeFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit);

      expect(result.status).toBe("removed");
    });

    it("throws when update returns no rows after existence check", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow({ status: "accepted" })]);
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        removeFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit),
      ).rejects.toThrow("Failed to removed friend connection");
    });

    it("throws 404 when connection not found", async () => {
      const { db } = mockDb();

      await expect(
        removeFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── updateFriendVisibility ───────────────────────────────────────

  describe("updateFriendVisibility", () => {
    it("updates with correct version", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeConnectionRow({ version: 2 })]);

      const result = await updateFriendVisibility(
        db,
        ACCOUNT_ID,
        CONNECTION_ID,
        { encryptedData: Buffer.from(new Uint8Array(40)).toString("base64"), version: 1 },
        AUTH,
        mockAudit,
      );

      expect(result.version).toBe(2);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "friend-visibility.updated" }),
      );
    });

    it("throws 409 on version mismatch", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      // existsFn: entity exists
      chain.limit.mockResolvedValueOnce([{ id: CONNECTION_ID }]);

      await expect(
        updateFriendVisibility(
          db,
          ACCOUNT_ID,
          CONNECTION_ID,
          { encryptedData: Buffer.from(new Uint8Array(40)).toString("base64"), version: 999 },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("throws 404 when connection not found", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        updateFriendVisibility(
          db,
          ACCOUNT_ID,
          CONNECTION_ID,
          { encryptedData: Buffer.from(new Uint8Array(40)).toString("base64"), version: 1 },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── archiveFriendConnection ──────────────────────────────────────

  describe("archiveFriendConnection", () => {
    it("archives an active connection", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ id: CONNECTION_ID }]);

      await archiveFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit);

      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "friend-connection.archived" }),
      );
    });

    it("throws 409 when already archived", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      // First where: update().set().where() -> chain (for .returning)
      // Second where: select().from().where() -> existence check (entity exists)
      chain.where
        .mockReturnValueOnce(chain) // update chain
        .mockResolvedValueOnce([{ id: CONNECTION_ID }]); // existence check: exists

      await expect(
        archiveFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "ALREADY_ARCHIVED" }));
    });

    it("throws 404 when connection not found", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.where
        .mockReturnValueOnce(chain) // update chain
        .mockResolvedValueOnce([]); // existence check: not found

      await expect(
        archiveFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── restoreFriendConnection ──────────────────────────────────────

  describe("restoreFriendConnection", () => {
    it("restores an archived connection", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeConnectionRow({ archived: false, version: 2 })]);

      const result = await restoreFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit);

      expect(result.version).toBe(2);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "friend-connection.restored" }),
      );
    });

    it("throws 409 when not archived", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      // First where: update().set().where() -> chain (for .returning)
      // Second where: select().from().where() -> existence check
      chain.where
        .mockReturnValueOnce(chain) // update chain
        .mockResolvedValueOnce([{ id: CONNECTION_ID }]); // exists but not archived

      await expect(
        restoreFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "NOT_ARCHIVED" }));
    });

    it("throws 404 when connection not found", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.where
        .mockReturnValueOnce(chain) // update chain
        .mockResolvedValueOnce([]); // not found

      await expect(
        restoreFriendConnection(db, ACCOUNT_ID, CONNECTION_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });
});
