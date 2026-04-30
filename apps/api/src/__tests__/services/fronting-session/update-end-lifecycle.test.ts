import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";

import { AUTH, FS_ID, SYSTEM_ID, VALID_BLOB_BASE64, makeFSRow } from "./internal.js";

import type { FrontingSessionId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/crypto", async () => {
  const { createCryptoMock } = await import("../../helpers/mock-crypto.js");
  return createCryptoMock();
});

vi.mock("../../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../../lib/validate-subject-ids.js", () => ({
  validateSubjectIds: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

// ── Import under test ────────────────────────────────────────────────

const { updateFrontingSession, endFrontingSession } =
  await import("../../../services/fronting-session/update.js");
const { deleteFrontingSession, archiveFrontingSession, restoreFrontingSession } =
  await import("../../../services/fronting-session/lifecycle.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

// ── Tests ────────────────────────────────────────────────────────────

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
        brandId<FrontingSessionId>("fs_00000000-0000-0000-0000-000000000000"),
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
        brandId<FrontingSessionId>("fs_00000000-0000-0000-0000-000000000000"),
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

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
        brandId<FrontingSessionId>("fs_00000000-0000-0000-0000-000000000000"),
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
