import { brandId } from "@pluralscape/types";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { VALID_BLOB_BASE64 } from "../../../helpers/mock-crypto.js";
import { mockDb } from "../../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../../helpers/mock-ownership.js";

import {
  AUTH,
  CF_ID,
  COMMENT_ID,
  MEMBER_ID,
  SE_ID,
  SESSION_ID,
  SYSTEM_ID,
  makeCommentRow,
} from "./internal.js";

import type { MockChain } from "../../../helpers/mock-db.js";
import type { FrontingCommentId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/crypto", async () => {
  const { createCryptoMock } = await import("../../../helpers/mock-crypto.js");
  return createCryptoMock();
});

vi.mock("../../../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../../../lib/validate-subject-ids.js", () => ({
  validateSubjectIds: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../../../lib/system-ownership.js");
const { createFrontingComment } =
  await import("../../../../services/fronting-session/comments/create.js");
const { listFrontingComments, getFrontingComment } =
  await import("../../../../services/fronting-session/comments/queries.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const VALID_CREATE_PARAMS = {
  encryptedData: VALID_BLOB_BASE64,
  memberId: MEMBER_ID,
  customFrontId: undefined,
  structureEntityId: undefined,
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

// ── Tests ────────────────────────────────────────────────────────────

describe("createFrontingComment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
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
      {
        encryptedData: VALID_BLOB_BASE64,
        memberId: undefined,
        customFrontId: CF_ID,
        structureEntityId: undefined,
      },
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
      {
        encryptedData: VALID_BLOB_BASE64,
        memberId: undefined,
        customFrontId: undefined,
        structureEntityId: SE_ID,
      },
      AUTH,
      mockAudit,
    );

    expect(result.structureEntityId).toBe(SE_ID);
  });
});

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

    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns comments for a session", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SESSION_ID }]);
    chain.limit.mockResolvedValueOnce([makeCommentRow()]);

    const result = await listFrontingComments(db, SYSTEM_ID, SESSION_ID, AUTH);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(COMMENT_ID);
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
    expect(result.data).toHaveLength(25);
    expect(result.nextCursor).not.toBeNull();
  });
});

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
        brandId<FrontingCommentId>("fc_00000000-0000-0000-0000-000000000000"),
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
