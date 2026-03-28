import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Mock dependencies before imports
vi.mock("../../lib/friend-access.js", () => ({
  assertFriendAccess: vi.fn(),
}));

vi.mock("../../lib/rls-context.js", () => ({
  withCrossAccountRead: vi.fn((db: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(db)),
}));

vi.mock("../../lib/encrypted-blob.js", () => ({
  encryptedBlobToBase64: vi.fn((blob: unknown) => `base64_${String(blob)}`),
}));

vi.mock("../../lib/bucket-access.js", () => ({
  filterVisibleEntities: vi.fn().mockReturnValue([]),
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
    encryptedData: "encryptedData",
    systemId: "systemId",
    archived: "archived",
  },
  frontingSessions: {
    id: "id",
    memberId: "memberId",
    customFrontId: "customFrontId",
    structureEntityId: "structureEntityId",
    startTime: "startTime",
    encryptedData: "encryptedData",
    systemId: "systemId",
    endTime: "endTime",
    archived: "archived",
  },
  keyGrants: {
    id: "id",
    bucketId: "bucketId",
    encryptedKey: "encryptedKey",
    keyVersion: "keyVersion",
    systemId: "systemId",
    friendAccountId: "friendAccountId",
    revokedAt: "revokedAt",
  },
  members: { id: "id", encryptedData: "encryptedData", systemId: "systemId", archived: "archived" },
  systemStructureEntities: {
    id: "id",
    encryptedData: "encryptedData",
    systemId: "systemId",
    archived: "archived",
  },
}));

// ── Imports after mocks ─────────────────────────────────────────

const { assertFriendAccess } = await import("../../lib/friend-access.js");

import { asDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AccountId,
  BucketId,
  FriendAccessContext,
  FriendConnectionId,
  SessionId,
  SystemId,
} from "@pluralscape/types";

// ── Test helpers ────────────────────────────────────────────────

const CONNECTION_ID = "fc_conn1" as FriendConnectionId;
const SYSTEM_ID = "sys_target" as SystemId;
const ACCOUNT_ID = "acc_caller" as AccountId;
const TARGET_ACCOUNT_ID = "acc_target" as AccountId;
const BUCKET_A = "bkt_aaa" as BucketId;

function makeAuth(): AuthContext {
  return {
    accountId: ACCOUNT_ID,
    systemId: null,
    sessionId: "sess_test" as SessionId,
    accountType: "system" as const,
    ownedSystemIds: new Set<SystemId>(),
    auditLogIpTracking: false,
  };
}

function makeAccessContext(overrides?: Partial<FriendAccessContext>): FriendAccessContext {
  return {
    targetAccountId: TARGET_ACCOUNT_ID,
    targetSystemId: SYSTEM_ID,
    connectionId: CONNECTION_ID,
    assignedBucketIds: [BUCKET_A],
    ...overrides,
  };
}

/**
 * Build a mock DB that returns empty arrays for all chain-terminal calls.
 * The service makes many sequential queries; `.where()` must be both
 * chainable (for `.limit()`) and thenable (when used as terminal).
 */
function makeDashboardDb(): ReturnType<typeof asDb> {
  // A thenable chain object: can be awaited (resolves to []) or chained further
  const makeThenable = (): Record<string, unknown> => {
    const obj: Record<string, unknown> = {};
    obj.select = vi.fn().mockReturnValue(obj);
    obj.from = vi.fn().mockReturnValue(obj);
    obj.where = vi.fn().mockReturnValue(obj);
    obj.limit = vi.fn().mockResolvedValue([]);
    // Make the chain itself thenable — awaiting it resolves to []
    obj.then = (resolve: (v: unknown[]) => void) => Promise.resolve([]).then(resolve);
    return obj;
  };

  return asDb(makeThenable() as never);
}

// ── Tests ───────────────────────────────────────────────────────

describe("getFriendDashboard", () => {
  // Import dynamically so mocks are in place
  let getFriendDashboard: typeof import("../../services/friend-dashboard.service.js").getFriendDashboard;

  beforeAll(async () => {
    const mod = await import("../../services/friend-dashboard.service.js");
    getFriendDashboard = mod.getFriendDashboard;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a complete dashboard response on happy path", async () => {
    const db = makeDashboardDb();

    vi.mocked(assertFriendAccess).mockResolvedValueOnce(makeAccessContext());

    const result = await getFriendDashboard(db, CONNECTION_ID, makeAuth());

    expect(result).toEqual({
      systemId: SYSTEM_ID,
      memberCount: 0,
      activeFronting: {
        sessions: [],
        isCofronting: false,
      },
      visibleMembers: [],
      visibleCustomFronts: [],
      visibleStructureEntities: [],
      keyGrants: [],
    });
  });

  it("calls assertFriendAccess with connection ID and auth", async () => {
    const db = makeDashboardDb();
    const auth = makeAuth();

    vi.mocked(assertFriendAccess).mockResolvedValueOnce(makeAccessContext());

    await getFriendDashboard(db, CONNECTION_ID, auth);

    expect(vi.mocked(assertFriendAccess)).toHaveBeenCalledWith(
      expect.anything(),
      CONNECTION_ID,
      auth,
    );
  });

  it("returns empty filtered arrays when no bucket assignments", async () => {
    const db = makeDashboardDb();

    vi.mocked(assertFriendAccess).mockResolvedValueOnce(
      makeAccessContext({ assignedBucketIds: [] }),
    );

    const result = await getFriendDashboard(db, CONNECTION_ID, makeAuth());

    expect(result.visibleMembers).toEqual([]);
    expect(result.visibleCustomFronts).toEqual([]);
    expect(result.visibleStructureEntities).toEqual([]);
    expect(result.activeFronting.sessions).toEqual([]);
    expect(result.memberCount).toBe(0);
  });

  it("propagates errors from assertFriendAccess", async () => {
    const db = makeDashboardDb();

    vi.mocked(assertFriendAccess).mockRejectedValueOnce(new Error("Friend connection not found"));

    await expect(getFriendDashboard(db, CONNECTION_ID, makeAuth())).rejects.toThrow(
      "Friend connection not found",
    );
  });
});
