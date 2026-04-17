import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assertFriendAccess } from "../../lib/friend-access.js";
import { mockDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AccountId,
  BucketId,
  FriendConnectionId,
  SessionId,
  SystemId,
} from "@pluralscape/types";

// ── Test helpers ────────────────────────────────────────────────────

const ACCOUNT_ID = brandId<AccountId>("acc_owner");
const FRIEND_ACCOUNT_ID = brandId<AccountId>("acc_friend");
const CONNECTION_ID = brandId<FriendConnectionId>("fc_conn1");
const INVERSE_CONNECTION_ID = brandId<FriendConnectionId>("fc_inverse");
const SYSTEM_ID = brandId<SystemId>("sys_target");
const SYSTEM_ID_B = brandId<SystemId>("sys_other");
const BUCKET_A = brandId<BucketId>("bkt_aaa");
const BUCKET_B = brandId<BucketId>("bkt_bbb");

function makeAuth(accountId: AccountId = ACCOUNT_ID): AuthContext {
  return {
    authMethod: "session" as const,
    accountId,
    systemId: null,
    sessionId: brandId<SessionId>("sess_test"),
    accountType: "system" as const,
    ownedSystemIds: new Set<SystemId>(),
    auditLogIpTracking: false,
  };
}

function makeConnection(
  overrides?: Partial<{
    id: string;
    accountId: string;
    friendAccountId: string;
    status: string;
    archived: boolean;
  }>,
): Record<string, unknown> {
  return {
    id: CONNECTION_ID,
    accountId: ACCOUNT_ID,
    friendAccountId: FRIEND_ACCOUNT_ID,
    status: "accepted",
    archived: false,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("assertFriendAccess", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws 404 when connection not found", async () => {
    const { db, chain } = mockDb();
    // select().from().where() returns empty array via limit default
    chain.where.mockResolvedValueOnce([]);

    await expect(assertFriendAccess(db, CONNECTION_ID, makeAuth())).rejects.toThrow(
      "Friend connection not found",
    );
  });

  it("throws 404 when accountId does not match auth", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([makeConnection({ accountId: "acc_other" })]);

    await expect(assertFriendAccess(db, CONNECTION_ID, makeAuth())).rejects.toThrow(
      "Friend connection not found",
    );
  });

  it("throws 404 when status is pending", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([makeConnection({ status: "pending" })]);

    await expect(assertFriendAccess(db, CONNECTION_ID, makeAuth())).rejects.toThrow(
      "Friend connection not found",
    );
  });

  it("throws 404 when status is blocked", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([makeConnection({ status: "blocked" })]);

    await expect(assertFriendAccess(db, CONNECTION_ID, makeAuth())).rejects.toThrow(
      "Friend connection not found",
    );
  });

  it("throws 404 when status is removed", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([makeConnection({ status: "removed" })]);

    await expect(assertFriendAccess(db, CONNECTION_ID, makeAuth())).rejects.toThrow(
      "Friend connection not found",
    );
  });

  it("throws 404 when connection is archived", async () => {
    const { db, chain } = mockDb();
    chain.where.mockResolvedValueOnce([makeConnection({ archived: true })]);

    await expect(assertFriendAccess(db, CONNECTION_ID, makeAuth())).rejects.toThrow(
      "Friend connection not found",
    );
  });

  it("throws 404 when inverse connection not found", async () => {
    const { db, chain } = mockDb();
    // Connection found
    chain.where.mockResolvedValueOnce([makeConnection()]);
    // Inverse connection query: .where() chains to .limit() which returns empty
    chain.limit.mockResolvedValueOnce([]);

    await expect(assertFriendAccess(db, CONNECTION_ID, makeAuth())).rejects.toThrow(
      "Friend connection not found",
    );
  });

  it("throws 404 when no bucket assignments and no systems for friend account", async () => {
    const { db, chain } = mockDb();
    // First query (connection): .where() terminal
    chain.where.mockResolvedValueOnce([makeConnection()]);
    // Second query (inverse connection): .where() chains, .limit() terminal
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: INVERSE_CONNECTION_ID }]);
    // Third query (bucket assignments): .where() terminal
    chain.where.mockResolvedValueOnce([]);
    // Fourth query (system fallback): .where() chains (default), .limit() terminal
    chain.limit.mockResolvedValueOnce([]);

    await expect(assertFriendAccess(db, CONNECTION_ID, makeAuth())).rejects.toThrow(
      "Friend connection not found",
    );
  });

  it("returns context with empty bucketIds when no assignments but system exists", async () => {
    const { db, chain } = mockDb();
    // First query (connection): .where() terminal
    chain.where.mockResolvedValueOnce([makeConnection()]);
    // Second query (inverse connection): .where() chains, .limit() terminal
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: INVERSE_CONNECTION_ID }]);
    // Third query (bucket assignments): .where() terminal
    chain.where.mockResolvedValueOnce([]);
    // Fourth query (system fallback): .where() chains (default), .limit() terminal
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);

    const result = await assertFriendAccess(db, CONNECTION_ID, makeAuth());

    expect(result).toEqual({
      targetAccountId: FRIEND_ACCOUNT_ID,
      targetSystemId: SYSTEM_ID,
      connectionId: CONNECTION_ID,
      assignedBucketIds: [],
    });
  });

  it("returns context with bucketIds and systemId from assignments", async () => {
    const { db, chain } = mockDb();
    // First query (connection): .where() terminal
    chain.where.mockResolvedValueOnce([makeConnection()]);
    // Second query (inverse connection): .where() chains, .limit() terminal
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: INVERSE_CONNECTION_ID }]);
    // Third query (bucket assignments): .where() terminal
    chain.where.mockResolvedValueOnce([
      { bucketId: BUCKET_A, systemId: SYSTEM_ID },
      { bucketId: BUCKET_B, systemId: SYSTEM_ID },
    ]);

    const result = await assertFriendAccess(db, CONNECTION_ID, makeAuth());

    expect(result).toEqual({
      targetAccountId: FRIEND_ACCOUNT_ID,
      targetSystemId: SYSTEM_ID,
      connectionId: CONNECTION_ID,
      assignedBucketIds: [BUCKET_A, BUCKET_B],
    });
  });

  it("throws 500 when bucket assignments reference multiple systems", async () => {
    const { db, chain } = mockDb();
    // First query (connection): .where() terminal
    chain.where.mockResolvedValueOnce([makeConnection()]);
    // Second query (inverse connection): .where() chains, .limit() terminal
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([{ id: INVERSE_CONNECTION_ID }]);
    // Third query (bucket assignments): .where() terminal
    chain.where.mockResolvedValueOnce([
      { bucketId: BUCKET_A, systemId: SYSTEM_ID },
      { bucketId: BUCKET_B, systemId: SYSTEM_ID_B },
    ]);

    await expect(assertFriendAccess(db, CONNECTION_ID, makeAuth())).rejects.toThrow(
      "multiple systems",
    );
  });
});
