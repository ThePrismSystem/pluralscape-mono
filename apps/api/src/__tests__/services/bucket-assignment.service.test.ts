import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb, type MockChain } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { AccountId, BucketId, FriendConnectionId, SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../services/bucket.service.js", () => ({
  assertBucketExists: vi.fn(),
}));

vi.mock("@pluralscape/db/pg", () => ({
  friendBucketAssignments: {
    friendConnectionId: "friend_connection_id",
    bucketId: "bucket_id",
    systemId: "system_id",
  },
  friendConnections: {
    id: "id",
    accountId: "account_id",
    friendAccountId: "friend_account_id",
    status: "status",
    archived: "archived",
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
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("kg_test-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  };
});

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { assertBucketExists } = await import("../../services/bucket.service.js");

const { assignBucketToFriend, unassignBucketFromFriend, listFriendBucketAssignments } =
  await import("../../services/bucket-assignment.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const BUCKET_ID = brandId<BucketId>("bkt_test-bucket");
const CONNECTION_ID = brandId<FriendConnectionId>("fc_test-connection");
const FRIEND_ACCOUNT_ID = brandId<AccountId>("acc_test-friend");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_PARAMS = {
  connectionId: CONNECTION_ID,
  encryptedBucketKey: Buffer.from("test-key-data").toString("base64"),
  keyVersion: 1,
};

function makeConnectionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CONNECTION_ID,
    accountId: AUTH.accountId,
    friendAccountId: FRIEND_ACCOUNT_ID,
    status: "accepted",
    archived: false,
    ...overrides,
  };
}

function makeAssignmentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    friendConnectionId: CONNECTION_ID,
    bucketId: BUCKET_ID,
    systemId: SYSTEM_ID,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("bucket-assignment service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── assignBucketToFriend ───────────────────────────────────────────

  describe("assignBucketToFriend", () => {
    it("calls assertSystemOwnership", async () => {
      const { db, chain } = mockDb();
      // Connection query
      chain.limit.mockResolvedValueOnce([makeConnectionRow()]);
      // onConflictDoNothing().returning() for assignment
      chain.returning.mockResolvedValueOnce([makeAssignmentRow()]);
      // key grant insert returning
      chain.returning.mockResolvedValueOnce([{ id: "kg_test-id" }]);

      await assignBucketToFriend(db, SYSTEM_ID, BUCKET_ID, VALID_PARAMS, AUTH, mockAudit);

      expect(assertSystemOwnership).toHaveBeenCalledWith(SYSTEM_ID, AUTH);
    });

    it("calls assertBucketExists", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow()]);
      chain.returning.mockResolvedValueOnce([makeAssignmentRow()]);
      chain.returning.mockResolvedValueOnce([{ id: "kg_test-id" }]);

      await assignBucketToFriend(db, SYSTEM_ID, BUCKET_ID, VALID_PARAMS, AUTH, mockAudit);

      expect(assertBucketExists).toHaveBeenCalled();
    });

    it("throws NOT_FOUND when system ownership fails", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        assignBucketToFriend(db, SYSTEM_ID, BUCKET_ID, VALID_PARAMS, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("returns expected result shape", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow()]);
      chain.returning.mockResolvedValueOnce([makeAssignmentRow()]);
      chain.returning.mockResolvedValueOnce([{ id: "kg_test-id" }]);

      const result = await assignBucketToFriend(
        db,
        SYSTEM_ID,
        BUCKET_ID,
        VALID_PARAMS,
        AUTH,
        mockAudit,
      );

      expect(result).toEqual({
        friendConnectionId: CONNECTION_ID,
        bucketId: BUCKET_ID,
        friendAccountId: FRIEND_ACCOUNT_ID,
      });
    });

    it("emits audit event on new assignment", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow()]);
      chain.returning.mockResolvedValueOnce([makeAssignmentRow()]);
      chain.returning.mockResolvedValueOnce([{ id: "kg_test-id" }]);

      await assignBucketToFriend(db, SYSTEM_ID, BUCKET_ID, VALID_PARAMS, AUTH, mockAudit);

      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "friend-bucket-assignment.assigned" }),
      );
    });

    it("skips audit when assignment already existed (idempotent)", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow()]);
      // onConflictDoNothing returns empty (no insert happened)
      chain.returning.mockResolvedValueOnce([]);

      await assignBucketToFriend(db, SYSTEM_ID, BUCKET_ID, VALID_PARAMS, AUTH, mockAudit);

      expect(mockAudit).not.toHaveBeenCalled();
    });
  });

  // ── unassignBucketFromFriend ──────────────────────────────────────

  describe("unassignBucketFromFriend", () => {
    it("calls assertSystemOwnership", async () => {
      const { db, chain } = mockDb();
      // Connection query
      chain.limit.mockResolvedValueOnce([makeConnectionRow()]);
      // Delete returning
      chain.returning.mockResolvedValueOnce([makeAssignmentRow()]);
      // Key grant revoke update returning
      chain.returning.mockResolvedValueOnce([]);

      await unassignBucketFromFriend(db, SYSTEM_ID, BUCKET_ID, CONNECTION_ID, AUTH, mockAudit);

      expect(assertSystemOwnership).toHaveBeenCalledWith(SYSTEM_ID, AUTH);
    });

    it("emits audit event on unassignment", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow()]);
      chain.returning.mockResolvedValueOnce([makeAssignmentRow()]);
      chain.returning.mockResolvedValueOnce([]);

      await unassignBucketFromFriend(db, SYSTEM_ID, BUCKET_ID, CONNECTION_ID, AUTH, mockAudit);

      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "friend-bucket-assignment.unassigned" }),
      );
    });

    it("throws NOT_FOUND when assignment does not exist", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeConnectionRow()]);
      // Delete returning empty = not found
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        unassignBucketFromFriend(db, SYSTEM_ID, BUCKET_ID, CONNECTION_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── listFriendBucketAssignments ───────────────────────────────────

  describe("listFriendBucketAssignments", () => {
    /** Build a mockDb with innerJoin support for the list query (uses a join). */
    function mockDbWithJoin(): {
      db: ReturnType<typeof mockDb>["db"];
      chain: MockChain & { innerJoin: ReturnType<typeof vi.fn> };
    } {
      const innerJoin = vi.fn();
      const { db, chain } = mockDb();
      const extendedChain = chain as MockChain & { innerJoin: ReturnType<typeof vi.fn> };
      extendedChain.innerJoin = innerJoin;
      // Wire innerJoin into the fluent chain
      innerJoin.mockReturnValue(chain);
      // Also wire from() to return extended chain so innerJoin is available
      chain.from.mockReturnValue(extendedChain);
      return { db, chain: extendedChain };
    }

    it("calls assertSystemOwnership", async () => {
      const { db, chain } = mockDbWithJoin();
      chain.where.mockResolvedValueOnce([]);

      await listFriendBucketAssignments(db, SYSTEM_ID, BUCKET_ID, AUTH);

      expect(assertSystemOwnership).toHaveBeenCalledWith(SYSTEM_ID, AUTH);
    });

    it("returns empty array when no assignments", async () => {
      const { db, chain } = mockDbWithJoin();
      chain.where.mockResolvedValueOnce([]);

      const result = await listFriendBucketAssignments(db, SYSTEM_ID, BUCKET_ID, AUTH);

      expect(result).toEqual([]);
    });

    it("returns mapped results", async () => {
      const { db, chain } = mockDbWithJoin();
      chain.where.mockResolvedValueOnce([
        {
          friendConnectionId: CONNECTION_ID,
          bucketId: BUCKET_ID,
          friendAccountId: FRIEND_ACCOUNT_ID,
        },
      ]);

      const result = await listFriendBucketAssignments(db, SYSTEM_ID, BUCKET_ID, AUTH);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        friendConnectionId: CONNECTION_ID,
        bucketId: BUCKET_ID,
        friendAccountId: FRIEND_ACCOUNT_ID,
      });
    });
  });
});
