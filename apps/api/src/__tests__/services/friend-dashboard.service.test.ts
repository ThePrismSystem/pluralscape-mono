import { afterEach, describe, expect, it, vi } from "vitest";

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
  loadBucketTags: vi.fn().mockResolvedValue(new Map()),
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
const { filterVisibleEntities } = await import("../../lib/bucket-access.js");
const {
  getFriendDashboard,
  queryVisibleActiveFronting,
  queryVisibleMembers,
  queryVisibleCustomFronts,
  queryVisibleStructureEntities,
  queryMemberCount,
  queryActiveKeyGrants,
} = await import("../../services/friend-dashboard.service.js");

import { asDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AccountId,
  BucketId,
  FriendAccessContext,
  FriendConnectionId,
  SessionId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

// ── Test helpers ────────────────────────────────────────────────

const CONNECTION_ID = "fc_conn1" as FriendConnectionId;
const SYSTEM_ID = "sys_target" as SystemId;
const ACCOUNT_ID = "acc_caller" as AccountId;
const TARGET_ACCOUNT_ID = "acc_target" as AccountId;
const BUCKET_A = "bkt_aaa" as BucketId;
const BUCKET_B = "bkt_bbb" as BucketId;

/** Placeholder encrypted data — the mock encryptedBlobToBase64 calls String() on it. */
const STUB_ENCRYPTED_DATA = "enc_stub";

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
function makeDashboardDb(
  resolvedRows?: unknown[],
): ReturnType<typeof asDb> & { _chain: Record<string, unknown> } {
  const rows = resolvedRows ?? [];
  // A thenable chain object: can be awaited (resolves to rows) or chained further
  const makeThenable = (): Record<string, unknown> => {
    const obj: Record<string, unknown> = {};
    obj.select = vi.fn().mockReturnValue(obj);
    obj.from = vi.fn().mockReturnValue(obj);
    obj.where = vi.fn().mockReturnValue(obj);
    obj.limit = vi.fn().mockResolvedValue(rows);
    // Make the chain itself thenable — awaiting it resolves to rows
    obj.then = (resolve: (v: unknown[]) => void) => Promise.resolve(rows).then(resolve);
    return obj;
  };

  const chain = makeThenable();
  return Object.assign(asDb(chain as never), { _chain: chain });
}

// ── Tests ───────────────────────────────────────────────────────

describe("getFriendDashboard", () => {
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

// ── queryVisibleActiveFronting ──────────────────────────────────

describe("queryVisibleActiveFronting", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty when friendBucketIds is empty", async () => {
    const db = makeDashboardDb();

    const result = await queryVisibleActiveFronting(db, SYSTEM_ID, [] as readonly BucketId[]);

    expect(result).toEqual({ sessions: [], isCofronting: false });
  });

  it("returns empty when no active sessions", async () => {
    const db = makeDashboardDb([]);

    const result = await queryVisibleActiveFronting(db, SYSTEM_ID, [BUCKET_A]);

    expect(result).toEqual({ sessions: [], isCofronting: false });
  });

  it("returns visible sessions via member bucket tags", async () => {
    const memberId = `mem_${crypto.randomUUID()}`;
    const sessionId = `fs_${crypto.randomUUID()}`;
    const startTime = Date.now() as UnixMillis;

    const sessionRow = {
      id: sessionId,
      memberId,
      customFrontId: null,
      structureEntityId: null,
      startTime,
      encryptedData: STUB_ENCRYPTED_DATA,
    };

    const db = makeDashboardDb([sessionRow]);

    // filterVisibleEntities should return the session row when called for sessions
    vi.mocked(filterVisibleEntities).mockReturnValueOnce([sessionRow]);

    const result = await queryVisibleActiveFronting(db, SYSTEM_ID, [BUCKET_A]);

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]?.id).toBe(sessionId);
    expect(result.sessions[0]?.memberId).toBe(memberId);
    expect(result.sessions[0]?.encryptedData).toBe(`base64_${STUB_ENCRYPTED_DATA}`);
  });

  it("detects co-fronting with 2+ member sessions", async () => {
    const memberIdA = `mem_${crypto.randomUUID()}`;
    const memberIdB = `mem_${crypto.randomUUID()}`;
    const sessionIdA = `fs_${crypto.randomUUID()}`;
    const sessionIdB = `fs_${crypto.randomUUID()}`;
    const startTime = Date.now() as UnixMillis;

    const sessionA = {
      id: sessionIdA,
      memberId: memberIdA,
      customFrontId: null,
      structureEntityId: null,
      startTime,
      encryptedData: STUB_ENCRYPTED_DATA,
    };
    const sessionB = {
      id: sessionIdB,
      memberId: memberIdB,
      customFrontId: null,
      structureEntityId: null,
      startTime,
      encryptedData: STUB_ENCRYPTED_DATA,
    };

    const db = makeDashboardDb([sessionA, sessionB]);

    vi.mocked(filterVisibleEntities).mockReturnValueOnce([sessionA, sessionB]);

    const result = await queryVisibleActiveFronting(db, SYSTEM_ID, [BUCKET_A]);

    expect(result.isCofronting).toBe(true);
    expect(result.sessions).toHaveLength(2);
  });

  it("does not count custom-front-only sessions for co-fronting", async () => {
    const memberId = `mem_${crypto.randomUUID()}`;
    const customFrontId = `cf_${crypto.randomUUID()}`;
    const sessionIdA = `fs_${crypto.randomUUID()}`;
    const sessionIdB = `fs_${crypto.randomUUID()}`;
    const startTime = Date.now() as UnixMillis;

    const memberSession = {
      id: sessionIdA,
      memberId,
      customFrontId: null,
      structureEntityId: null,
      startTime,
      encryptedData: STUB_ENCRYPTED_DATA,
    };
    const cfOnlySession = {
      id: sessionIdB,
      memberId: null,
      customFrontId,
      structureEntityId: null,
      startTime,
      encryptedData: STUB_ENCRYPTED_DATA,
    };

    const db = makeDashboardDb([memberSession, cfOnlySession]);

    vi.mocked(filterVisibleEntities).mockReturnValueOnce([memberSession, cfOnlySession]);

    const result = await queryVisibleActiveFronting(db, SYSTEM_ID, [BUCKET_A]);

    expect(result.isCofronting).toBe(false);
    expect(result.sessions).toHaveLength(2);
  });

  it("does not count 2 custom-front-only sessions as co-fronting", async () => {
    const cfIdA = `cf_${crypto.randomUUID()}`;
    const cfIdB = `cf_${crypto.randomUUID()}`;
    const sessionIdA = `fs_${crypto.randomUUID()}`;
    const sessionIdB = `fs_${crypto.randomUUID()}`;
    const startTime = Date.now() as UnixMillis;

    const cfSessionA = {
      id: sessionIdA,
      memberId: null,
      customFrontId: cfIdA,
      structureEntityId: null,
      startTime,
      encryptedData: STUB_ENCRYPTED_DATA,
    };
    const cfSessionB = {
      id: sessionIdB,
      memberId: null,
      customFrontId: cfIdB,
      structureEntityId: null,
      startTime,
      encryptedData: STUB_ENCRYPTED_DATA,
    };

    const db = makeDashboardDb([cfSessionA, cfSessionB]);

    vi.mocked(filterVisibleEntities).mockReturnValueOnce([cfSessionA, cfSessionB]);

    const result = await queryVisibleActiveFronting(db, SYSTEM_ID, [BUCKET_A]);

    expect(result.isCofronting).toBe(false);
    expect(result.sessions).toHaveLength(2);
  });
});

// ── queryVisibleMembers ─────────────────────────────────────────

describe("queryVisibleMembers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty when friendBucketIds is empty", async () => {
    const db = makeDashboardDb();

    const result = await queryVisibleMembers(db, SYSTEM_ID, [] as readonly BucketId[]);

    expect(result).toEqual([]);
  });

  it("returns filtered members via bucket intersection", async () => {
    const memberIdA = `mem_${crypto.randomUUID()}`;
    const memberIdB = `mem_${crypto.randomUUID()}`;

    const rowA = { id: memberIdA, encryptedData: STUB_ENCRYPTED_DATA };
    const rowB = { id: memberIdB, encryptedData: STUB_ENCRYPTED_DATA };

    const db = makeDashboardDb([rowA, rowB]);

    // filterVisibleEntities is called once by filterAndMapEntities.
    // Mock it to return only rowA as visible.
    vi.mocked(filterVisibleEntities).mockReturnValueOnce([rowA]);

    const result = await queryVisibleMembers(db, SYSTEM_ID, [BUCKET_A, BUCKET_B]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(memberIdA);
    expect(result[0]?.encryptedData).toBe(`base64_${STUB_ENCRYPTED_DATA}`);
  });
});

// ── queryVisibleCustomFronts ────────────────────────────────────

describe("queryVisibleCustomFronts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty when friendBucketIds is empty", async () => {
    const db = makeDashboardDb();

    const result = await queryVisibleCustomFronts(db, SYSTEM_ID, [] as readonly BucketId[]);

    expect(result).toEqual([]);
  });
});

// ── queryVisibleStructureEntities ───────────────────────────────

describe("queryVisibleStructureEntities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty when friendBucketIds is empty", async () => {
    const db = makeDashboardDb();

    const result = await queryVisibleStructureEntities(db, SYSTEM_ID, [] as readonly BucketId[]);

    expect(result).toEqual([]);
  });
});

// ── queryMemberCount ────────────────────────────────────────────

describe("queryMemberCount", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns zero when no members", async () => {
    const db = makeDashboardDb([{ value: 0 }]);

    const result = await queryMemberCount(db, SYSTEM_ID);

    expect(result).toBe(0);
  });

  it("returns count value", async () => {
    const db = makeDashboardDb([{ value: 5 }]);

    const result = await queryMemberCount(db, SYSTEM_ID);

    expect(result).toBe(5);
  });

  it("returns zero when result is undefined", async () => {
    const db = makeDashboardDb([]);

    const result = await queryMemberCount(db, SYSTEM_ID);

    expect(result).toBe(0);
  });
});

// ── queryActiveKeyGrants ────────────────────────────────────────

describe("queryActiveKeyGrants", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty when no grants", async () => {
    const db = makeDashboardDb([]);

    const result = await queryActiveKeyGrants(db, SYSTEM_ID, ACCOUNT_ID);

    expect(result).toEqual([]);
  });

  it("maps key grants with base64 encoding", async () => {
    const grantId = `kg_${crypto.randomUUID()}`;
    const bucketId = `bkt_${crypto.randomUUID()}`;

    const grantRow = {
      id: grantId,
      bucketId,
      encryptedKey: new Uint8Array([1, 2, 3]),
      keyVersion: 1,
    };

    const db = makeDashboardDb([grantRow]);

    const result = await queryActiveKeyGrants(db, SYSTEM_ID, ACCOUNT_ID);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(grantId);
    expect(result[0]?.bucketId).toBe(bucketId);
    expect(result[0]?.encryptedKey).toBe(Buffer.from(new Uint8Array([1, 2, 3])).toString("base64"));
    expect(result[0]?.keyVersion).toBe(1);
  });
});
