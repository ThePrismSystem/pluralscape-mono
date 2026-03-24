import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { VALID_BLOB_BASE64 } from "../helpers/mock-crypto.js";
import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { MockChain } from "../helpers/mock-db.js";
import type {
  CustomFrontId,
  FrontingCommentId,
  FrontingSessionId,
  MemberId,
  SystemId,
  SystemStructureEntityId,
} from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/crypto", async () => {
  const { createCryptoMock } = await import("../helpers/mock-crypto.js");
  return createCryptoMock();
});

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
  createFrontingComment,
  listFrontingComments,
  getFrontingComment,
  updateFrontingComment,
  deleteFrontingComment,
  archiveFrontingComment,
  restoreFrontingComment,
} = await import("../../services/fronting-comment.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_a1b2c3d4-e5f6-7890-abcd-ef1234567890" as SystemId;
const SESSION_ID = "fs_b2c3d4e5-f6a7-8901-bcde-f12345678901" as FrontingSessionId;
const COMMENT_ID = "fc_c3d4e5f6-a7b8-9012-cdef-123456789012" as FrontingCommentId;
const MEMBER_ID = "mem_d4e5f6a7-b8c9-0123-defa-234567890123" as MemberId;
const CF_ID = "cf_e5f6a7b8-c9d0-1234-efab-345678901234" as CustomFrontId;
const SE_ID = "ste_f6a7b8c9-d0e1-2345-fabc-456789012345" as SystemStructureEntityId;

const AUTH: AuthContext = {
  accountId: "acct_a1b2c3d4-e5f6-7890-abcd-ef1234567890" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_b2c3d4e5-f6a7-8901-bcde-f12345678901" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_CREATE_PARAMS = {
  encryptedData: VALID_BLOB_BASE64,
  memberId: MEMBER_ID,
};

const VALID_UPDATE_PARAMS = {
  encryptedData: VALID_BLOB_BASE64,
  version: 1,
};

function makeCommentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: COMMENT_ID,
    frontingSessionId: SESSION_ID,
    systemId: SYSTEM_ID,
    memberId: MEMBER_ID,
    customFrontId: null,
    structureEntityId: null,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ── createFrontingComment ────────────────────────────────────────────

describe("createFrontingComment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a fronting comment successfully", async () => {
    const { db, chain } = mockDb();
    // resolveSessionStartTime: session lookup returns a valid session
    chain.limit.mockResolvedValueOnce([{ startTime: 1000, archived: false }]);
    // validateSubjectIds: member lookup
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // insert returning
    chain.returning.mockResolvedValueOnce([makeCommentRow()]);

    const result = await createFrontingComment(
      db,
      SYSTEM_ID,
      SESSION_ID,
      VALID_CREATE_PARAMS,
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(COMMENT_ID);
    expect(result.frontingSessionId).toBe(SESSION_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.memberId).toBe(MEMBER_ID);
    expect(chain.transaction).toHaveBeenCalled();
  });

  it("calls audit writer with correct params after creation", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ startTime: 1000, archived: false }]);
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.returning.mockResolvedValueOnce([makeCommentRow()]);

    await createFrontingComment(db, SYSTEM_ID, SESSION_ID, VALID_CREATE_PARAMS, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(chain, {
      eventType: "fronting-comment.created",
      actor: { kind: "account", id: AUTH.accountId },
      detail: "Fronting comment created",
      systemId: SYSTEM_ID,
    });
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      createFrontingComment(db, SYSTEM_ID, SESSION_ID, VALID_CREATE_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body (parseAndValidateBlob fails)", async () => {
    const { db } = mockDb();

    await expect(
      createFrontingComment(db, SYSTEM_ID, SESSION_ID, { bad: "data" }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 404 when parent fronting session not found", async () => {
    const { db, chain } = mockDb();
    // resolveSessionStartTime: no session found
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      createFrontingComment(db, SYSTEM_ID, SESSION_ID, VALID_CREATE_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "Fronting session not found",
      }),
    );
  });

  it("throws 400 when parent fronting session is archived", async () => {
    const { db, chain } = mockDb();
    // resolveSessionStartTime: session is archived
    chain.limit.mockResolvedValueOnce([{ startTime: 1000, archived: true }]);

    await expect(
      createFrontingComment(db, SYSTEM_ID, SESSION_ID, VALID_CREATE_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 400,
        code: "SESSION_ARCHIVED",
        message: "Cannot add comments to an archived session",
      }),
    );
  });

  it("throws when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ startTime: 1000, archived: false }]);
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createFrontingComment(db, SYSTEM_ID, SESSION_ID, VALID_CREATE_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow("Failed to create fronting comment");
  });

  it("accepts create params with customFrontId instead of memberId", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ startTime: 1000, archived: false }]);
    chain.limit.mockResolvedValueOnce([{ id: CF_ID }]);
    chain.returning.mockResolvedValueOnce([
      makeCommentRow({ memberId: null, customFrontId: CF_ID }),
    ]);

    const result = await createFrontingComment(
      db,
      SYSTEM_ID,
      SESSION_ID,
      { encryptedData: VALID_BLOB_BASE64, customFrontId: CF_ID },
      AUTH,
      mockAudit,
    );

    expect(result.customFrontId).toBe(CF_ID);
    expect(result.memberId).toBeNull();
  });

  it("accepts create params with structureEntityId", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ startTime: 1000, archived: false }]);
    chain.limit.mockResolvedValueOnce([{ id: SE_ID }]);
    chain.returning.mockResolvedValueOnce([
      makeCommentRow({ memberId: null, structureEntityId: SE_ID }),
    ]);

    const result = await createFrontingComment(
      db,
      SYSTEM_ID,
      SESSION_ID,
      { encryptedData: VALID_BLOB_BASE64, structureEntityId: SE_ID },
      AUTH,
      mockAudit,
    );

    expect(result.structureEntityId).toBe(SE_ID);
  });
});

// ── listFrontingComments ─────────────────────────────────────────────

describe("listFrontingComments", () => {
  async function callListWithFilter(opts = {}): Promise<MockChain> {
    const { db, chain } = mockDb();
    // session lookup
    chain.limit.mockResolvedValueOnce([{ id: SESSION_ID }]);
    // comments query
    chain.limit.mockResolvedValueOnce([]);
    await listFrontingComments(db, SYSTEM_ID, SESSION_ID, AUTH, opts);
    return chain;
  }

  /** The session lookup also calls .where(), so the comments filter is the second call. */
  function captureCommentsWhereArg(chain: MockChain): unknown {
    return chain.where.mock.calls[1]?.[0];
  }

  let baseWhereArg: unknown;
  beforeAll(async () => {
    const chain = await callListWithFilter();
    baseWhereArg = captureCommentsWhereArg(chain);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty page when no comments exist", async () => {
    const { db, chain } = mockDb();
    // session lookup
    chain.limit.mockResolvedValueOnce([{ id: SESSION_ID }]);
    // comments query
    chain.limit.mockResolvedValueOnce([]);

    const result = await listFrontingComments(db, SYSTEM_ID, SESSION_ID, AUTH);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns comments for a session", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SESSION_ID }]);
    chain.limit.mockResolvedValueOnce([makeCommentRow()]);

    const result = await listFrontingComments(db, SYSTEM_ID, SESSION_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(COMMENT_ID);
  });

  it("throws 404 when parent session not found", async () => {
    const { db } = mockDb();
    // session lookup returns empty

    await expect(listFrontingComments(db, SYSTEM_ID, SESSION_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "Fronting session not found",
      }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(listFrontingComments(db, SYSTEM_ID, SESSION_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("applies cursor when provided", async () => {
    const chain = await callListWithFilter({ cursor: "fc_cursor-value" });

    expect(chain.where).toHaveBeenCalledTimes(2);
    expect(captureCommentsWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("includes archived comments when includeArchived is true", async () => {
    const chain = await callListWithFilter({ includeArchived: true });

    expect(chain.where).toHaveBeenCalledTimes(2);
    expect(captureCommentsWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("excludes archived comments by default", async () => {
    const chain = await callListWithFilter();

    expect(chain.where).toHaveBeenCalledTimes(2);
  });

  it("caps limit to MAX_PAGE_LIMIT", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SESSION_ID }]);
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingComments(db, SYSTEM_ID, SESSION_ID, AUTH, { limit: 999 });

    // MAX_PAGE_LIMIT is 100, so limit should be called with 101 (effectiveLimit + 1)
    expect(chain.limit).toHaveBeenCalledWith(101);
  });

  it("uses DEFAULT_PAGE_LIMIT when no limit provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SESSION_ID }]);
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingComments(db, SYSTEM_ID, SESSION_ID, AUTH);

    // DEFAULT_PAGE_LIMIT is 25, so limit should be called with 26
    expect(chain.limit).toHaveBeenCalledWith(26);
  });

  it("respects custom limit within bounds", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SESSION_ID }]);
    chain.limit.mockResolvedValueOnce([]);

    await listFrontingComments(db, SYSTEM_ID, SESSION_ID, AUTH, { limit: 10 });

    // effectiveLimit 10 + 1 = 11
    expect(chain.limit).toHaveBeenCalledWith(11);
  });

  it("returns hasMore true when more pages exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SESSION_ID }]);
    // Return 26 rows for default limit of 25 (one extra signals hasMore)
    const rows = Array.from({ length: 26 }, (_, i) =>
      makeCommentRow({ id: `fc_${String(i).padStart(36, "0")}` }),
    );
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listFrontingComments(db, SYSTEM_ID, SESSION_ID, AUTH);

    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(25);
    expect(result.nextCursor).not.toBeNull();
  });
});

// ── getFrontingComment ───────────────────────────────────────────────

describe("getFrontingComment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns comment for valid IDs", async () => {
    const { db, chain } = mockDb();
    // session lookup
    chain.limit.mockResolvedValueOnce([{ id: SESSION_ID }]);
    // comment lookup
    chain.limit.mockResolvedValueOnce([makeCommentRow()]);

    const result = await getFrontingComment(db, SYSTEM_ID, SESSION_ID, COMMENT_ID, AUTH);

    expect(result.id).toBe(COMMENT_ID);
    expect(result.frontingSessionId).toBe(SESSION_ID);
  });

  it("throws 404 when parent session not found", async () => {
    const { db } = mockDb();
    // session lookup returns empty

    await expect(getFrontingComment(db, SYSTEM_ID, SESSION_ID, COMMENT_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "Fronting session not found",
      }),
    );
  });

  it("throws 404 when comment not found", async () => {
    const { db, chain } = mockDb();
    // session exists
    chain.limit.mockResolvedValueOnce([{ id: SESSION_ID }]);
    // comment not found
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      getFrontingComment(
        db,
        SYSTEM_ID,
        SESSION_ID,
        "fc_00000000-0000-0000-0000-000000000000" as FrontingCommentId,
        AUTH,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "Fronting comment not found",
      }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(getFrontingComment(db, SYSTEM_ID, SESSION_ID, COMMENT_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

// ── updateFrontingComment ────────────────────────────────────────────

describe("updateFrontingComment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates comment with version increment", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeCommentRow({ version: 2 })]);

    const result = await updateFrontingComment(
      db,
      SYSTEM_ID,
      SESSION_ID,
      COMMENT_ID,
      VALID_UPDATE_PARAMS,
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(chain.transaction).toHaveBeenCalled();
  });

  it("calls audit writer with correct params after update", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeCommentRow({ version: 2 })]);

    await updateFrontingComment(
      db,
      SYSTEM_ID,
      SESSION_ID,
      COMMENT_ID,
      VALID_UPDATE_PARAMS,
      AUTH,
      mockAudit,
    );

    expect(mockAudit).toHaveBeenCalledWith(chain, {
      eventType: "fronting-comment.updated",
      actor: { kind: "account", id: AUTH.accountId },
      detail: "Fronting comment updated",
      systemId: SYSTEM_ID,
    });
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(
      updateFrontingComment(
        db,
        SYSTEM_ID,
        SESSION_ID,
        COMMENT_ID,
        { bad: "data" },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 409 on version conflict (entity still exists)", async () => {
    const { db, chain } = mockDb();
    // update returns no rows (version mismatch)
    chain.returning.mockResolvedValueOnce([]);
    // existence check returns the entity
    chain.limit.mockResolvedValueOnce([{ id: COMMENT_ID }]);

    await expect(
      updateFrontingComment(
        db,
        SYSTEM_ID,
        SESSION_ID,
        COMMENT_ID,
        VALID_UPDATE_PARAMS,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when comment not found during OCC check", async () => {
    const { db, chain } = mockDb();
    // update returns no rows
    chain.returning.mockResolvedValueOnce([]);
    // existence check also returns empty
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateFrontingComment(
        db,
        SYSTEM_ID,
        SESSION_ID,
        COMMENT_ID,
        VALID_UPDATE_PARAMS,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      updateFrontingComment(
        db,
        SYSTEM_ID,
        SESSION_ID,
        COMMENT_ID,
        VALID_UPDATE_PARAMS,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── deleteFrontingComment ────────────────────────────────────────────

describe("deleteFrontingComment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes a fronting comment successfully", async () => {
    const { db, chain } = mockDb();
    // existence check
    chain.limit.mockResolvedValueOnce([{ id: COMMENT_ID }]);

    await deleteFrontingComment(db, SYSTEM_ID, SESSION_ID, COMMENT_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(chain.delete).toHaveBeenCalled();
  });

  it("calls audit writer with correct params on delete", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: COMMENT_ID }]);

    await deleteFrontingComment(db, SYSTEM_ID, SESSION_ID, COMMENT_ID, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(chain, {
      eventType: "fronting-comment.deleted",
      actor: { kind: "account", id: AUTH.accountId },
      detail: "Fronting comment deleted",
      systemId: SYSTEM_ID,
    });
  });

  it("throws 404 when comment not found", async () => {
    const { db } = mockDb();
    // existence check returns empty

    await expect(
      deleteFrontingComment(db, SYSTEM_ID, SESSION_ID, COMMENT_ID, AUTH, mockAudit),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "Fronting comment not found",
      }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      deleteFrontingComment(db, SYSTEM_ID, SESSION_ID, COMMENT_ID, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── archiveFrontingComment ───────────────────────────────────────────

describe("archiveFrontingComment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("archives a fronting comment successfully", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: COMMENT_ID }]);

    await archiveFrontingComment(db, SYSTEM_ID, SESSION_ID, COMMENT_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(chain, {
      eventType: "fronting-comment.archived",
      actor: { kind: "account", id: AUTH.accountId },
      detail: "Fronting comment archived",
      systemId: SYSTEM_ID,
    });
  });

  it("throws 404 when comment not found (update returns no rows)", async () => {
    const { db } = mockDb();

    await expect(
      archiveFrontingComment(
        db,
        SYSTEM_ID,
        SESSION_ID,
        "fc_00000000-0000-0000-0000-000000000000" as FrontingCommentId,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "Fronting comment not found",
      }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      archiveFrontingComment(db, SYSTEM_ID, SESSION_ID, COMMENT_ID, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 ALREADY_ARCHIVED when comment exists but is already archived", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([{ id: COMMENT_ID }]);

    await expect(
      archiveFrontingComment(db, SYSTEM_ID, SESSION_ID, COMMENT_ID, AUTH, mockAudit),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "ALREADY_ARCHIVED",
        message: "Fronting comment is already archived",
      }),
    );
  });
});

// ── restoreFrontingComment ───────────────────────────────────────────

describe("restoreFrontingComment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restores an archived fronting comment", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([
      makeCommentRow({ version: 2, archived: false, archivedAt: null }),
    ]);

    const result = await restoreFrontingComment(
      db,
      SYSTEM_ID,
      SESSION_ID,
      COMMENT_ID,
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(result.archived).toBe(false);
    expect(chain.transaction).toHaveBeenCalled();
  });

  it("calls audit writer with correct params on restore", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeCommentRow({ version: 2, archived: false })]);

    await restoreFrontingComment(db, SYSTEM_ID, SESSION_ID, COMMENT_ID, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(chain, {
      eventType: "fronting-comment.restored",
      actor: { kind: "account", id: AUTH.accountId },
      detail: "Fronting comment restored",
      systemId: SYSTEM_ID,
    });
  });

  it("throws 404 when comment not found", async () => {
    const { db } = mockDb();

    await expect(
      restoreFrontingComment(
        db,
        SYSTEM_ID,
        SESSION_ID,
        "fc_00000000-0000-0000-0000-000000000000" as FrontingCommentId,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "Fronting comment not found",
      }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      restoreFrontingComment(db, SYSTEM_ID, SESSION_ID, COMMENT_ID, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 NOT_ARCHIVED when comment exists but is not archived", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([{ id: COMMENT_ID }]);

    await expect(
      restoreFrontingComment(db, SYSTEM_ID, SESSION_ID, COMMENT_ID, AUTH, mockAudit),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "NOT_ARCHIVED",
        message: "Fronting comment is not archived",
      }),
    );
  });
});
