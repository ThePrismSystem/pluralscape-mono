import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContext } from "../../lib/auth-context.js";
import type { BucketId, FriendAccessContext, FriendConnectionId, SystemId } from "@pluralscape/types";

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock("../../lib/friend-access.js", () => ({
  assertFriendAccess: vi.fn(),
}));

vi.mock("../../lib/rls-context.js", () => ({
  withCrossAccountRead: vi.fn((_db: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
}));

vi.mock("@pluralscape/db/pg", () => ({
  bucketContentTags: {
    entityId: "entityId",
    bucketId: "bucketId",
    systemId: "systemId",
    entityType: "entityType",
  },
  customFronts: {
    id: "id",
    systemId: "systemId",
    archived: "archived",
    updatedAt: "updatedAt",
  },
  frontingSessions: {
    id: "id",
    systemId: "systemId",
    endTime: "endTime",
    archived: "archived",
    updatedAt: "updatedAt",
  },
  members: {
    id: "id",
    systemId: "systemId",
    archived: "archived",
    updatedAt: "updatedAt",
  },
  systemStructureEntities: {
    id: "id",
    systemId: "systemId",
    archived: "archived",
    updatedAt: "updatedAt",
  },
}));

// ── Mock tx chain ─────────────────────────────────────────────────

const mockTx = {
  select: vi.fn(),
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
};

function wireChain(): void {
  for (const fn of Object.values(mockTx)) {
    fn.mockReset();
  }
  mockTx.select.mockReturnValue(mockTx);
  mockTx.from.mockReturnValue(mockTx);
  mockTx.innerJoin.mockReturnValue(mockTx);
  // where() is the terminal call for these queries -- resolves to rows
  mockTx.where.mockResolvedValue([]);
  mockTx.limit.mockResolvedValue([]);
}

wireChain();

// ── Imports after mocks ───────────────────────────────────────────

const { assertFriendAccess } = await import("../../lib/friend-access.js");
const { getFriendDashboardSync } = await import(
  "../../services/friend-dashboard-sync.service.js"
);

// ── Fixtures ──────────────────────────────────────────────────────

const CONNECTION_ID = "fc_conn-test" as FriendConnectionId;
const SYSTEM_ID = "sys_target" as SystemId;
const BUCKET_A = "bkt_aaa" as BucketId;

function makeAuth(): AuthContext {
  return {
    accountId: "acc_caller",
    systemId: null,
    sessionId: "sess_test",
    accountType: "system" as const,
    ownedSystemIds: new Set<SystemId>(),
    auditLogIpTracking: false,
  } as never;
}

function makeAccessContext(overrides?: Partial<FriendAccessContext>): FriendAccessContext {
  return {
    targetAccountId: "acc_target",
    targetSystemId: SYSTEM_ID,
    connectionId: CONNECTION_ID,
    assignedBucketIds: [BUCKET_A],
    ...overrides,
  } as never;
}

// ── Tests ─────────────────────────────────────────────────────────

describe("getFriendDashboardSync", () => {
  beforeEach(() => {
    wireChain();
  });

  it("returns combined entries from all 4 entity types", async () => {
    vi.mocked(assertFriendAccess).mockResolvedValueOnce(makeAccessContext());

    // memberSyncEntry query
    mockTx.where.mockResolvedValueOnce([{ count: 3, latest: 1000 }]);
    // customFrontSyncEntry query
    mockTx.where.mockResolvedValueOnce([{ count: 2, latest: 900 }]);
    // structureEntitySyncEntry query
    mockTx.where.mockResolvedValueOnce([{ count: 1, latest: 800 }]);
    // frontingSessionSyncEntry query
    mockTx.where.mockResolvedValueOnce([{ count: 4, latest: 1100 }]);

    const result = await getFriendDashboardSync({} as never, CONNECTION_ID, makeAuth());

    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.entries).toHaveLength(4);
    expect(result.entries[0]).toEqual({
      entityType: "member",
      count: 3,
      latestUpdatedAt: 1000,
    });
    expect(result.entries[1]).toEqual({
      entityType: "custom-front",
      count: 2,
      latestUpdatedAt: 900,
    });
    expect(result.entries[2]).toEqual({
      entityType: "structure-entity",
      count: 1,
      latestUpdatedAt: 800,
    });
    expect(result.entries[3]).toEqual({
      entityType: "fronting-session",
      count: 4,
      latestUpdatedAt: 1100,
    });
  });

  it("returns zero counts when bucket-filtered helpers have empty bucketIds", async () => {
    vi.mocked(assertFriendAccess).mockResolvedValueOnce(
      makeAccessContext({ assignedBucketIds: [] }),
    );

    // Only frontingSessionSyncEntry runs a query (no bucket filter)
    mockTx.where.mockResolvedValueOnce([{ count: 2, latest: 500 }]);

    const result = await getFriendDashboardSync({} as never, CONNECTION_ID, makeAuth());

    expect(result.entries).toHaveLength(4);

    // Members, custom fronts, structure entities all hit the early return
    expect(result.entries[0]).toEqual({
      entityType: "member",
      count: 0,
      latestUpdatedAt: 0,
    });
    expect(result.entries[1]).toEqual({
      entityType: "custom-front",
      count: 0,
      latestUpdatedAt: 0,
    });
    expect(result.entries[2]).toEqual({
      entityType: "structure-entity",
      count: 0,
      latestUpdatedAt: 0,
    });

    // Fronting session always queries (no bucket filter)
    expect(result.entries[3]).toEqual({
      entityType: "fronting-session",
      count: 2,
      latestUpdatedAt: 500,
    });
  });

  it("coalesces null count and latest to zero", async () => {
    vi.mocked(assertFriendAccess).mockResolvedValueOnce(makeAccessContext());

    // All queries return undefined result (null count/latest)
    mockTx.where.mockResolvedValueOnce([{ count: undefined, latest: undefined }]);
    mockTx.where.mockResolvedValueOnce([{ count: undefined, latest: undefined }]);
    mockTx.where.mockResolvedValueOnce([{ count: undefined, latest: undefined }]);
    mockTx.where.mockResolvedValueOnce([{ count: undefined, latest: undefined }]);

    const result = await getFriendDashboardSync({} as never, CONNECTION_ID, makeAuth());

    for (const entry of result.entries) {
      expect(entry.count).toBe(0);
      expect(entry.latestUpdatedAt).toBe(0);
    }
  });

  it("coalesces when query returns empty array (no result row)", async () => {
    vi.mocked(assertFriendAccess).mockResolvedValueOnce(makeAccessContext());

    // All queries return empty array -- destructured [result] is undefined
    mockTx.where.mockResolvedValueOnce([]);
    mockTx.where.mockResolvedValueOnce([]);
    mockTx.where.mockResolvedValueOnce([]);
    mockTx.where.mockResolvedValueOnce([]);

    const result = await getFriendDashboardSync({} as never, CONNECTION_ID, makeAuth());

    for (const entry of result.entries) {
      expect(entry.count).toBe(0);
      expect(entry.latestUpdatedAt).toBe(0);
    }
  });

  it("propagates errors from assertFriendAccess", async () => {
    vi.mocked(assertFriendAccess).mockRejectedValueOnce(
      new Error("Friend connection not found"),
    );

    await expect(
      getFriendDashboardSync({} as never, CONNECTION_ID, makeAuth()),
    ).rejects.toThrow("Friend connection not found");
  });

  it("handles mixed: some entities have data, some have null aggregates", async () => {
    vi.mocked(assertFriendAccess).mockResolvedValueOnce(makeAccessContext());

    // member: has data
    mockTx.where.mockResolvedValueOnce([{ count: 5, latest: 2000 }]);
    // custom-front: null aggregates
    mockTx.where.mockResolvedValueOnce([{ count: null, latest: null }]);
    // structure-entity: has data
    mockTx.where.mockResolvedValueOnce([{ count: 1, latest: 1500 }]);
    // fronting-session: no rows
    mockTx.where.mockResolvedValueOnce([]);

    const result = await getFriendDashboardSync({} as never, CONNECTION_ID, makeAuth());

    expect(result.entries[0]).toEqual({
      entityType: "member",
      count: 5,
      latestUpdatedAt: 2000,
    });
    expect(result.entries[1]).toEqual({
      entityType: "custom-front",
      count: 0,
      latestUpdatedAt: 0,
    });
    expect(result.entries[2]).toEqual({
      entityType: "structure-entity",
      count: 1,
      latestUpdatedAt: 1500,
    });
    expect(result.entries[3]).toEqual({
      entityType: "fronting-session",
      count: 0,
      latestUpdatedAt: 0,
    });
  });
});
