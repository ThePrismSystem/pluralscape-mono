import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VALID_BLOB_BASE64 } from "../../../helpers/mock-crypto.js";
import { mockDb } from "../../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../../helpers/mock-ownership.js";

import { AUTH, COMMENT_ID, SESSION_ID, SYSTEM_ID, makeCommentRow } from "./internal.js";

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
const { updateFrontingComment } =
  await import("../../../../services/fronting-session/comments/update.js");
const { deleteFrontingComment, archiveFrontingComment, restoreFrontingComment } =
  await import("../../../../services/fronting-session/comments/lifecycle.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const VALID_UPDATE_PARAMS = {
  encryptedData: VALID_BLOB_BASE64,
  version: 1,
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

// ── Tests ────────────────────────────────────────────────────────────

describe("updateFrontingComment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
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

describe("deleteFrontingComment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
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

describe("archiveFrontingComment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
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
        brandId<FrontingCommentId>("fc_00000000-0000-0000-0000-000000000000"),
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

describe("restoreFrontingComment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
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
        brandId<FrontingCommentId>("fc_00000000-0000-0000-0000-000000000000"),
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
