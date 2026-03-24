import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type {
  CustomFrontId,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

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

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/validate-subject-ids.js", () => ({
  validateSubjectIds: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const {
  createFrontingSession,
  listFrontingSessions,
  getFrontingSession,
  updateFrontingSession,
  endFrontingSession,
  deleteFrontingSession,
  archiveFrontingSession,
  restoreFrontingSession,
  getActiveFronting,
  parseFrontingSessionQuery,
} = await import("../../services/fronting-session.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_a1b2c3d4-e5f6-7890-abcd-ef1234567890" as SystemId;
const FS_ID = "fs_a1b2c3d4-e5f6-7890-abcd-ef1234567890" as FrontingSessionId;
const MEMBER_ID = "mem_a1b2c3d4-e5f6-7890-abcd-ef1234567890" as MemberId;
const CF_ID = "cf_a1b2c3d4-e5f6-7890-abcd-ef1234567890" as CustomFrontId;
const SE_ID = "ste_a1b2c3d4-e5f6-7890-abcd-ef1234567890" as SystemStructureEntityId;

const AUTH: AuthContext = {
  accountId: "acct_a1b2c3d4-e5f6-7890-abcd-ef1234567890" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_a1b2c3d4-e5f6-7890-abcd-ef1234567890" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

/** Valid create params that pass CreateFrontingSessionBodySchema (requires at least one subject). */
const VALID_CREATE_PARAMS = {
  encryptedData: VALID_BLOB_BASE64,
  startTime: 1000,
  memberId: MEMBER_ID,
};

function makeFSRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: FS_ID,
    systemId: SYSTEM_ID,
    memberId: MEMBER_ID,
    customFrontId: null,
    structureEntityId: null,
    startTime: 1000,
    endTime: null,
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

describe("createFrontingSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a fronting session successfully", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeFSRow()]);

    const result = await createFrontingSession(db, SYSTEM_ID, VALID_CREATE_PARAMS, AUTH, mockAudit);

    expect(result.id).toBe(FS_ID);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "fronting-session.created" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      createFrontingSession(db, SYSTEM_ID, VALID_CREATE_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body (parseAndValidateBlob fails)", async () => {
    const { db } = mockDb();

    await expect(
      createFrontingSession(db, SYSTEM_ID, { bad: "data" }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createFrontingSession(db, SYSTEM_ID, VALID_CREATE_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow("Failed to create fronting session");
  });

  it("calls audit writer with correct params after successful insert", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeFSRow()]);

    await createFrontingSession(db, SYSTEM_ID, VALID_CREATE_PARAMS, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(chain, {
      eventType: "fronting-session.created",
      actor: { kind: "account", id: AUTH.accountId },
      detail: "Fronting session created",
      systemId: SYSTEM_ID,
    });
  });
});

// ── listFrontingSessions ──────────────────────────────────────────────

describe("listFrontingSessions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty page when no sessions exist", async () => {
    const { db } = mockDb();

    const result = await listFrontingSessions(db, SYSTEM_ID, AUTH);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("returns sessions for system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeFSRow()]);

    const result = await listFrontingSessions(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(FS_ID);
  });

  it("applies cursor when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingSessions(db, SYSTEM_ID, AUTH, { cursor: "fs_cursor-id" });

    expect(chain.where).toHaveBeenCalled();
  });

  it("applies memberId filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingSessions(db, SYSTEM_ID, AUTH, { memberId: MEMBER_ID });

    expect(chain.where).toHaveBeenCalled();
  });

  it("applies customFrontId filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingSessions(db, SYSTEM_ID, AUTH, { customFrontId: CF_ID });

    expect(chain.where).toHaveBeenCalled();
  });

  it("applies structureEntityId filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingSessions(db, SYSTEM_ID, AUTH, { structureEntityId: SE_ID });

    expect(chain.where).toHaveBeenCalled();
  });

  it("applies startFrom filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingSessions(db, SYSTEM_ID, AUTH, { startFrom: 500 });

    expect(chain.where).toHaveBeenCalled();
  });

  it("applies startUntil filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingSessions(db, SYSTEM_ID, AUTH, { startUntil: 2000 });

    expect(chain.where).toHaveBeenCalled();
  });

  it("applies activeOnly filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingSessions(db, SYSTEM_ID, AUTH, { activeOnly: true });

    expect(chain.where).toHaveBeenCalled();
  });

  it("includes archived sessions when includeArchived is true", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingSessions(db, SYSTEM_ID, AUTH, { includeArchived: true });

    expect(chain.where).toHaveBeenCalled();
  });

  it("excludes archived sessions by default", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingSessions(db, SYSTEM_ID, AUTH);

    expect(chain.where).toHaveBeenCalled();
  });

  it("caps limit to MAX_PAGE_LIMIT", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingSessions(db, SYSTEM_ID, AUTH, { limit: 999 });

    // MAX_PAGE_LIMIT is 100, so limit should be called with 101 (effectiveLimit + 1)
    expect(chain.limit).toHaveBeenCalledWith(101);
  });

  it("uses DEFAULT_PAGE_LIMIT when no limit provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingSessions(db, SYSTEM_ID, AUTH);

    // DEFAULT_PAGE_LIMIT is 25, so limit should be called with 26
    expect(chain.limit).toHaveBeenCalledWith(26);
  });
});

// ── getFrontingSession ─────────────────────────────────────────────────

describe("getFrontingSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns session for valid ID", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeFSRow()]);

    const result = await getFrontingSession(db, SYSTEM_ID, FS_ID, AUTH);

    expect(result.id).toBe(FS_ID);
  });

  it("throws 404 when not found", async () => {
    const { db } = mockDb();

    await expect(
      getFrontingSession(
        db,
        SYSTEM_ID,
        "fs_00000000-0000-0000-0000-000000000000" as FrontingSessionId,
        AUTH,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── updateFrontingSession ──────────────────────────────────────────────

describe("updateFrontingSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates session with version increment", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeFSRow({ version: 2 })]);

    const result = await updateFrontingSession(
      db,
      SYSTEM_ID,
      FS_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "fronting-session.updated" }),
    );
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(
      updateFrontingSession(db, SYSTEM_ID, FS_ID, { bad: "data" }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([{ id: FS_ID }]);

    await expect(
      updateFrontingSession(
        db,
        SYSTEM_ID,
        FS_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when session not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateFrontingSession(
        db,
        SYSTEM_ID,
        FS_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── endFrontingSession ──────────────────────────────────────────────────

describe("endFrontingSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("ends a session successfully", async () => {
    const { db, chain } = mockDb();
    // First select: current session lookup
    chain.limit.mockResolvedValueOnce([{ id: FS_ID, startTime: 1000, endTime: null }]);
    // Update returning
    chain.returning.mockResolvedValueOnce([makeFSRow({ endTime: 2000, version: 2 })]);

    const result = await endFrontingSession(
      db,
      SYSTEM_ID,
      FS_ID,
      { endTime: 2000, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(FS_ID);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "fronting-session.ended" }),
    );
  });

  it("throws 400 for invalid payload (safeParse fails)", async () => {
    const { db } = mockDb();

    await expect(
      endFrontingSession(db, SYSTEM_ID, FS_ID, { bad: "data" }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 404 when session not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      endFrontingSession(db, SYSTEM_ID, FS_ID, { endTime: 2000, version: 1 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 when session already ended", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: FS_ID, startTime: 1000, endTime: 1500 }]);

    await expect(
      endFrontingSession(db, SYSTEM_ID, FS_ID, { endTime: 2000, version: 1 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "ALREADY_ENDED" }));
  });

  it("throws 400 when endTime is before startTime", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: FS_ID, startTime: 1000, endTime: null }]);

    await expect(
      endFrontingSession(db, SYSTEM_ID, FS_ID, { endTime: 500, version: 1 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 when endTime equals startTime", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: FS_ID, startTime: 1000, endTime: null }]);

    await expect(
      endFrontingSession(db, SYSTEM_ID, FS_ID, { endTime: 1000, version: 1 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 409 on OCC version conflict", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: FS_ID, startTime: 1000, endTime: null }])
      .mockResolvedValueOnce([{ id: FS_ID }]);
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      endFrontingSession(db, SYSTEM_ID, FS_ID, { endTime: 2000, version: 1 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 on OCC when session no longer exists", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: FS_ID, startTime: 1000, endTime: null }])
      .mockResolvedValueOnce([]);
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      endFrontingSession(db, SYSTEM_ID, FS_ID, { endTime: 2000, version: 1 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── deleteFrontingSession ──────────────────────────────────────────────

describe("deleteFrontingSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes session with no dependents", async () => {
    const { db, chain } = mockDb();
    // existence check
    chain.limit.mockResolvedValueOnce([{ id: FS_ID, startTime: 1000 }]);
    // comment count check — where returns result directly (no .limit)
    chain.where
      .mockReturnValueOnce(chain) // existence → .limit()
      .mockResolvedValueOnce([{ count: 0 }]); // count query resolves directly

    await deleteFrontingSession(db, SYSTEM_ID, FS_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "fronting-session.deleted" }),
    );
  });

  it("throws 404 when session not found", async () => {
    const { db } = mockDb();

    await expect(
      deleteFrontingSession(
        db,
        SYSTEM_ID,
        "fs_00000000-0000-0000-0000-000000000000" as FrontingSessionId,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 when session has dependent comments", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: FS_ID, startTime: 1000 }]);
    chain.where
      .mockReturnValueOnce(chain) // existence → .limit()
      .mockResolvedValueOnce([{ count: 3 }]); // count query

    await expect(deleteFrontingSession(db, SYSTEM_ID, FS_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "HAS_DEPENDENTS",
        message: expect.stringContaining("3 non-archived comment(s)"),
      }),
    );
  });

  it("throws internal error when count query returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: FS_ID, startTime: 1000 }]);
    chain.where
      .mockReturnValueOnce(chain) // existence → .limit()
      .mockResolvedValueOnce([]); // count returns empty (unexpected)

    await expect(deleteFrontingSession(db, SYSTEM_ID, FS_ID, AUTH, mockAudit)).rejects.toThrow(
      "Unexpected: count query returned no rows",
    );
  });
});

// ── archiveFrontingSession ──────────────────────────────────────────────

describe("archiveFrontingSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives a fronting session (delegates to archiveEntity)", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: FS_ID }]);

    await archiveFrontingSession(db, SYSTEM_ID, FS_ID, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "fronting-session.archived" }),
    );
  });

  it("throws 404 when session not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveFrontingSession(
        db,
        SYSTEM_ID,
        "fs_00000000-0000-0000-0000-000000000000" as FrontingSessionId,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── restoreFrontingSession ──────────────────────────────────────────────

describe("restoreFrontingSession", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived fronting session", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeFSRow({ version: 2, archived: false })]);

    const result = await restoreFrontingSession(db, SYSTEM_ID, FS_ID, AUTH, mockAudit);

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "fronting-session.restored" }),
    );
  });

  it("throws 404 when archived session not found", async () => {
    const { db } = mockDb();

    await expect(
      restoreFrontingSession(
        db,
        SYSTEM_ID,
        "fs_00000000-0000-0000-0000-000000000000" as FrontingSessionId,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── getActiveFronting ──────────────────────────────────────────────────

describe("getActiveFronting", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty sessions and isCofronting false when no active sessions", async () => {
    const { db } = mockDb();

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.sessions).toEqual([]);
    expect(result.isCofronting).toBe(false);
    expect(result.entityMemberMap).toEqual({});
  });

  it("returns isCofronting false for single member session", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeFSRow()]);

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.sessions).toHaveLength(1);
    expect(result.isCofronting).toBe(false);
  });

  it("returns isCofronting true for multiple member sessions", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeFSRow({ id: "fs_00000000-0000-0000-0000-000000000001" }),
      makeFSRow({
        id: "fs_00000000-0000-0000-0000-000000000002",
        memberId: "mem_00000000-0000-0000-0000-000000000099",
      }),
    ]);

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.sessions).toHaveLength(2);
    expect(result.isCofronting).toBe(true);
  });

  it("does not count custom-front-only sessions for cofronting", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeFSRow({ id: "fs_00000000-0000-0000-0000-000000000001" }),
      makeFSRow({
        id: "fs_00000000-0000-0000-0000-000000000002",
        memberId: null,
        customFrontId: CF_ID,
        structureEntityId: null,
      }),
    ]);

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.sessions).toHaveLength(2);
    // Only one member session, so not cofronting
    expect(result.isCofronting).toBe(false);
  });

  it("counts structureEntityId sessions for cofronting", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeFSRow({ id: "fs_00000000-0000-0000-0000-000000000001" }),
      makeFSRow({
        id: "fs_00000000-0000-0000-0000-000000000002",
        memberId: null,
        structureEntityId: SE_ID,
      }),
    ]);
    // First where call (main query) returns chain; second where call (links query) resolves directly
    chain.where
      .mockReturnValueOnce(chain) // main session query → .orderBy()
      .mockResolvedValueOnce([]); // links query resolves to empty array

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.isCofronting).toBe(true);
  });

  it("builds entityMemberMap from link query", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeFSRow({ id: "fs_00000000-0000-0000-0000-000000000001", structureEntityId: SE_ID }),
    ]);
    // First where (main query) returns chain; second where (links) resolves to links array
    chain.where
      .mockReturnValueOnce(chain) // main session query → .orderBy()
      .mockResolvedValueOnce([
        { parentEntityId: SE_ID, memberId: "mem_00000000-0000-0000-0000-000000000011" },
        { parentEntityId: SE_ID, memberId: "mem_00000000-0000-0000-0000-000000000012" },
      ]);

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.entityMemberMap[SE_ID]).toEqual([
      "mem_00000000-0000-0000-0000-000000000011",
      "mem_00000000-0000-0000-0000-000000000012",
    ]);
  });

  it("skips link query when no structureEntityIds in sessions", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeFSRow({ structureEntityId: null })]);

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.entityMemberMap).toEqual({});
  });

  it("handles multiple entities in entityMemberMap", async () => {
    const seId2 = "ste_00000000-0000-0000-0000-000000000002" as SystemStructureEntityId;
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeFSRow({ id: "fs_00000000-0000-0000-0000-000000000001", structureEntityId: SE_ID }),
      makeFSRow({
        id: "fs_00000000-0000-0000-0000-000000000002",
        memberId: null,
        structureEntityId: seId2,
      }),
    ]);
    // First where (main query) returns chain; second where (links) resolves to array
    chain.where
      .mockReturnValueOnce(chain) // main session query → .orderBy()
      .mockResolvedValueOnce([
        { parentEntityId: SE_ID, memberId: "mem_00000000-0000-0000-0000-00000000000a" },
        { parentEntityId: seId2, memberId: "mem_00000000-0000-0000-0000-00000000000b" },
        { parentEntityId: seId2, memberId: "mem_00000000-0000-0000-0000-00000000000c" },
      ]);

    const result = await getActiveFronting(db, SYSTEM_ID, AUTH);

    expect(result.entityMemberMap[SE_ID]).toEqual(["mem_00000000-0000-0000-0000-00000000000a"]);
    expect(result.entityMemberMap[seId2]).toEqual([
      "mem_00000000-0000-0000-0000-00000000000b",
      "mem_00000000-0000-0000-0000-00000000000c",
    ]);
  });
});

// ── parseFrontingSessionQuery ──────────────────────────────────────────

describe("parseFrontingSessionQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed query for valid input", () => {
    const result = parseFrontingSessionQuery({});

    expect(result).toBeDefined();
  });

  it("parses valid activeOnly filter", () => {
    const result = parseFrontingSessionQuery({ activeOnly: "true" });

    expect(result.activeOnly).toBe(true);
  });

  it("throws 400 VALIDATION_ERROR for invalid memberId prefix", () => {
    expect(() => parseFrontingSessionQuery({ memberId: "invalid_no_prefix" })).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });
});
