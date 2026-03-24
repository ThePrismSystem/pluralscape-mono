import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { VALID_BLOB_BASE64 } from "../helpers/mock-crypto.js";
import { captureWhereArg, mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { MockChain } from "../helpers/mock-db.js";
import type { CheckInRecordId, MemberId, SystemId, TimerId } from "@pluralscape/types";

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

// ── Import under test ────────────────────────────────────────────────

const {
  createCheckInRecord,
  listCheckInRecords,
  getCheckInRecord,
  respondCheckInRecord,
  dismissCheckInRecord,
  archiveCheckInRecord,
  deleteCheckInRecord,
  parseCheckInRecordQuery,
} = await import("../../services/check-in-record.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

// IDs that pass through brandedIdQueryParam validation must be prefix + valid UUID
const SYSTEM_ID = "sys_00000000-0000-4000-a000-000000000001" as SystemId;
const RECORD_ID = "cir_00000000-0000-4000-a000-000000000002" as CheckInRecordId;
const TIMER_ID = "tmr_00000000-0000-4000-a000-000000000003" as TimerId;
const MEMBER_ID = "mem_00000000-0000-4000-a000-000000000004" as MemberId;

const AUTH: AuthContext = {
  accountId: "acct_00000000-0000-4000-a000-000000000005" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_00000000-0000-4000-a000-000000000006" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

function makePendingRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: RECORD_ID,
    systemId: SYSTEM_ID,
    timerConfigId: TIMER_ID,
    scheduledAt: 1000,
    respondedByMemberId: null,
    respondedAt: null,
    dismissed: false,
    encryptedData: null,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

function makeRespondedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...makePendingRow(),
    respondedByMemberId: MEMBER_ID,
    respondedAt: 2000,
    dismissed: false,
    ...overrides,
  };
}

function makeDismissedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...makePendingRow(),
    respondedByMemberId: null,
    respondedAt: null,
    dismissed: true,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("createCheckInRecord", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a check-in record with no encrypted data", async () => {
    const { db, chain } = mockDb();
    // timerConfig lookup returns a match
    chain.limit.mockResolvedValueOnce([{ id: TIMER_ID }]);
    // insert returning
    chain.returning.mockResolvedValueOnce([makePendingRow()]);

    const result = await createCheckInRecord(
      db,
      SYSTEM_ID,
      { timerConfigId: TIMER_ID, scheduledAt: 1000 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(RECORD_ID);
    expect(result.status).toBe("pending");
    expect(result.respondedByMemberId).toBeNull();
    expect(result.respondedAt).toBeNull();
    expect(result.dismissed).toBe(false);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "check-in-record.created" }),
    );
  });

  it("creates a check-in record with encrypted data", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: TIMER_ID }]);
    chain.returning.mockResolvedValueOnce([
      makePendingRow({ encryptedData: new Uint8Array([1, 2, 3]) }),
    ]);

    const result = await createCheckInRecord(
      db,
      SYSTEM_ID,
      { timerConfigId: TIMER_ID, scheduledAt: 1000, encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(RECORD_ID);
    expect(result.encryptedData).toEqual(expect.any(String));
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      createCheckInRecord(
        db,
        SYSTEM_ID,
        { timerConfigId: TIMER_ID, scheduledAt: 1000 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid payload", async () => {
    const { db } = mockDb();

    await expect(
      createCheckInRecord(db, SYSTEM_ID, { bad: "data" }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 when timer config not found in system", async () => {
    const { db, chain } = mockDb();
    // timerConfig lookup returns empty
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      createCheckInRecord(
        db,
        SYSTEM_ID,
        { timerConfigId: TIMER_ID, scheduledAt: 1000 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Timer config not found in system",
      }),
    );
  });

  it("throws when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: TIMER_ID }]);
    // insert returning empty
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createCheckInRecord(
        db,
        SYSTEM_ID,
        { timerConfigId: TIMER_ID, scheduledAt: 1000 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("Failed to create check-in record");
  });

  it("throws 400 for scheduledAt of zero", async () => {
    const { db } = mockDb();

    await expect(
      createCheckInRecord(
        db,
        SYSTEM_ID,
        { timerConfigId: TIMER_ID, scheduledAt: 0 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for non-integer scheduledAt", async () => {
    const { db } = mockDb();

    await expect(
      createCheckInRecord(
        db,
        SYSTEM_ID,
        { timerConfigId: TIMER_ID, scheduledAt: 1.5 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for invalid timerConfigId format", async () => {
    const { db } = mockDb();

    await expect(
      createCheckInRecord(
        db,
        SYSTEM_ID,
        { timerConfigId: "bad-id", scheduledAt: 1000 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

// ── listCheckInRecords ───────────────────────────────────────────────

describe("listCheckInRecords", () => {
  async function callListWithFilter(opts = {}): Promise<MockChain> {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);
    await listCheckInRecords(db, SYSTEM_ID, AUTH, opts);
    return chain;
  }

  let baseWhereArg: unknown;
  beforeAll(async () => {
    const chain = await callListWithFilter();
    baseWhereArg = captureWhereArg(chain);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty page when no records exist", async () => {
    const { db } = mockDb();

    const result = await listCheckInRecords(db, SYSTEM_ID, AUTH);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("returns pending records", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makePendingRow()]);

    const result = await listCheckInRecords(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(RECORD_ID);
    expect(result.items[0]?.status).toBe("pending");
  });

  it("returns responded records with correct status", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeRespondedRow()]);

    const result = await listCheckInRecords(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe("responded");
    expect(result.items[0]?.respondedByMemberId).toBe(MEMBER_ID);
  });

  it("returns dismissed records with correct status", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeDismissedRow()]);

    const result = await listCheckInRecords(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe("dismissed");
    expect(result.items[0]?.dismissed).toBe(true);
  });

  it("caps limit to MAX_PAGE_LIMIT", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listCheckInRecords(db, SYSTEM_ID, AUTH, { limit: 999 });

    // MAX_PAGE_LIMIT is 100, so limit(100 + 1) = 101
    expect(chain.limit).toHaveBeenCalledWith(101);
  });

  it("uses default limit when none provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listCheckInRecords(db, SYSTEM_ID, AUTH);

    // DEFAULT_PAGE_LIMIT is 25, so limit(25 + 1) = 26
    expect(chain.limit).toHaveBeenCalledWith(26);
  });

  it("applies timerConfigId filter", async () => {
    const chain = await callListWithFilter({ timerConfigId: TIMER_ID });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("applies pending filter", async () => {
    const chain = await callListWithFilter({ pending: true });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("applies includeArchived filter", async () => {
    const chain = await callListWithFilter({ includeArchived: true });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("applies cursor filter", async () => {
    const chain = await callListWithFilter({ cursor: "cir_some-cursor" });

    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(listCheckInRecords(db, SYSTEM_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("returns hasMore true when more records exist", async () => {
    const { db, chain } = mockDb();
    // Return limit+1 rows to trigger hasMore
    const rows = Array.from({ length: 26 }, (_, i) =>
      makePendingRow({ id: `cir_00000000-0000-4000-a000-0000000001${String(i).padStart(2, "0")}` }),
    );
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listCheckInRecords(db, SYSTEM_ID, AUTH);

    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(25);
    expect(result.nextCursor).not.toBeNull();
  });

  it("excludes archived records by default (no pending, no includeArchived)", async () => {
    const chain = await callListWithFilter({});

    expect(chain.where).toHaveBeenCalledTimes(1);
  });
});

// ── getCheckInRecord ─────────────────────────────────────────────────

describe("getCheckInRecord", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a pending check-in record", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makePendingRow()]);

    const result = await getCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH);

    expect(result.id).toBe(RECORD_ID);
    expect(result.status).toBe("pending");
  });

  it("returns a responded check-in record", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeRespondedRow()]);

    const result = await getCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH);

    expect(result.status).toBe("responded");
    expect(result.respondedByMemberId).toBe(MEMBER_ID);
  });

  it("returns a dismissed check-in record", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeDismissedRow()]);

    const result = await getCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH);

    expect(result.status).toBe("dismissed");
    expect(result.dismissed).toBe(true);
  });

  it("throws 404 when not found", async () => {
    const { db } = mockDb();

    await expect(
      getCheckInRecord(
        db,
        SYSTEM_ID,
        "cir_00000000-0000-4000-a000-000000000099" as CheckInRecordId,
        AUTH,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(getCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("maps encryptedData to base64 when present", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makePendingRow({ encryptedData: new Uint8Array([1, 2, 3]) }),
    ]);

    const result = await getCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH);

    expect(result.encryptedData).toEqual(expect.any(String));
  });

  it("returns null encryptedData when not present", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makePendingRow({ encryptedData: null })]);

    const result = await getCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH);

    expect(result.encryptedData).toBeNull();
  });

  it("maps archivedAt through toUnixMillisOrNull", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makePendingRow({ archived: true, archivedAt: 5000 })]);

    const result = await getCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH);

    expect(result.archived).toBe(true);
    expect(result.archivedAt).toBe(5000);
  });
});

// ── respondCheckInRecord ─────────────────────────────────────────────

describe("respondCheckInRecord", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("responds to a pending check-in record", async () => {
    const { db, chain } = mockDb();
    // fetchPendingCheckIn lookup
    chain.limit.mockResolvedValueOnce([makePendingRow()]);
    // member lookup
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // update returning
    chain.returning.mockResolvedValueOnce([makeRespondedRow()]);

    const result = await respondCheckInRecord(
      db,
      SYSTEM_ID,
      RECORD_ID,
      { respondedByMemberId: MEMBER_ID },
      AUTH,
      mockAudit,
    );

    expect(result.status).toBe("responded");
    expect(result.respondedByMemberId).toBe(MEMBER_ID);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "check-in-record.responded" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      respondCheckInRecord(
        db,
        SYSTEM_ID,
        RECORD_ID,
        { respondedByMemberId: MEMBER_ID },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid payload", async () => {
    const { db } = mockDb();

    await expect(
      respondCheckInRecord(db, SYSTEM_ID, RECORD_ID, { bad: "data" }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for invalid respondedByMemberId format", async () => {
    const { db } = mockDb();

    await expect(
      respondCheckInRecord(
        db,
        SYSTEM_ID,
        RECORD_ID,
        { respondedByMemberId: "not-a-member-id" },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 404 when check-in record not found (fetchPendingCheckIn)", async () => {
    const { db, chain } = mockDb();
    // fetchPendingCheckIn lookup returns empty
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      respondCheckInRecord(
        db,
        SYSTEM_ID,
        RECORD_ID,
        { respondedByMemberId: MEMBER_ID },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 ALREADY_RESPONDED when record already responded (fetchPendingCheckIn)", async () => {
    const { db, chain } = mockDb();
    // fetchPendingCheckIn finds already-responded record
    chain.limit.mockResolvedValueOnce([makeRespondedRow()]);

    await expect(
      respondCheckInRecord(
        db,
        SYSTEM_ID,
        RECORD_ID,
        { respondedByMemberId: MEMBER_ID },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "ALREADY_RESPONDED" }));
  });

  it("throws 409 ALREADY_DISMISSED when record already dismissed (fetchPendingCheckIn)", async () => {
    const { db, chain } = mockDb();
    // fetchPendingCheckIn finds already-dismissed record
    chain.limit.mockResolvedValueOnce([makeDismissedRow()]);

    await expect(
      respondCheckInRecord(
        db,
        SYSTEM_ID,
        RECORD_ID,
        { respondedByMemberId: MEMBER_ID },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "ALREADY_DISMISSED" }));
  });

  it("throws 400 when member not found in system", async () => {
    const { db, chain } = mockDb();
    // fetchPendingCheckIn returns pending record
    chain.limit.mockResolvedValueOnce([makePendingRow()]);
    // member lookup returns empty
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      respondCheckInRecord(
        db,
        SYSTEM_ID,
        RECORD_ID,
        { respondedByMemberId: MEMBER_ID },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Member not found in system",
      }),
    );
  });

  it("throws 409 ALREADY_RESPONDED on concurrent overwrite (update returns empty, re-query shows responded)", async () => {
    const { db, chain } = mockDb();
    // fetchPendingCheckIn returns pending
    chain.limit.mockResolvedValueOnce([makePendingRow()]);
    // member lookup returns match
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // update returning empty (concurrent race)
    chain.returning.mockResolvedValueOnce([]);
    // re-query to determine conflict: responded
    chain.limit.mockResolvedValueOnce([makeRespondedRow()]);

    await expect(
      respondCheckInRecord(
        db,
        SYSTEM_ID,
        RECORD_ID,
        { respondedByMemberId: MEMBER_ID },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "ALREADY_RESPONDED" }));
  });

  it("throws 409 ALREADY_DISMISSED on concurrent overwrite (update returns empty, re-query shows dismissed)", async () => {
    const { db, chain } = mockDb();
    // fetchPendingCheckIn returns pending
    chain.limit.mockResolvedValueOnce([makePendingRow()]);
    // member lookup returns match
    chain.limit.mockResolvedValueOnce([{ id: MEMBER_ID }]);
    // update returning empty (concurrent race)
    chain.returning.mockResolvedValueOnce([]);
    // re-query: respondedAt is null, dismissed is true
    chain.limit.mockResolvedValueOnce([makeDismissedRow()]);

    await expect(
      respondCheckInRecord(
        db,
        SYSTEM_ID,
        RECORD_ID,
        { respondedByMemberId: MEMBER_ID },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "ALREADY_DISMISSED" }));
  });
});

// ── dismissCheckInRecord ─────────────────────────────────────────────

describe("dismissCheckInRecord", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dismisses a pending check-in record", async () => {
    const { db, chain } = mockDb();
    // fetchPendingCheckIn lookup
    chain.limit.mockResolvedValueOnce([makePendingRow()]);
    // update returning
    chain.returning.mockResolvedValueOnce([makeDismissedRow()]);

    const result = await dismissCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH, mockAudit);

    expect(result.status).toBe("dismissed");
    expect(result.dismissed).toBe(true);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "check-in-record.dismissed" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(dismissCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws 404 when check-in record not found (fetchPendingCheckIn)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(dismissCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws 409 ALREADY_RESPONDED when record already responded (fetchPendingCheckIn)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeRespondedRow()]);

    await expect(dismissCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "ALREADY_RESPONDED" }),
    );
  });

  it("throws 409 ALREADY_DISMISSED when record already dismissed (fetchPendingCheckIn)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeDismissedRow()]);

    await expect(dismissCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "ALREADY_DISMISSED" }),
    );
  });

  it("throws 409 ALREADY_RESPONDED on concurrent overwrite (update empty, re-query shows responded)", async () => {
    const { db, chain } = mockDb();
    // fetchPendingCheckIn returns pending
    chain.limit.mockResolvedValueOnce([makePendingRow()]);
    // update returning empty
    chain.returning.mockResolvedValueOnce([]);
    // re-query shows responded
    chain.limit.mockResolvedValueOnce([makeRespondedRow()]);

    await expect(dismissCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "ALREADY_RESPONDED" }),
    );
  });

  it("throws 409 ALREADY_DISMISSED on concurrent overwrite (update empty, re-query shows dismissed)", async () => {
    const { db, chain } = mockDb();
    // fetchPendingCheckIn returns pending
    chain.limit.mockResolvedValueOnce([makePendingRow()]);
    // update returning empty
    chain.returning.mockResolvedValueOnce([]);
    // re-query shows dismissed (respondedAt null)
    chain.limit.mockResolvedValueOnce([makeDismissedRow()]);

    await expect(dismissCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "ALREADY_DISMISSED" }),
    );
  });
});

// ── archiveCheckInRecord ─────────────────────────────────────────────

describe("archiveCheckInRecord", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("archives a check-in record", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: RECORD_ID }]);

    await archiveCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "check-in-record.archived" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(archiveCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws 409 ALREADY_ARCHIVED when already archived", async () => {
    const { db, chain } = mockDb();
    // update returns empty
    chain.returning.mockResolvedValueOnce([]);
    // re-query finds the existing record
    chain.limit.mockResolvedValueOnce([{ id: RECORD_ID }]);

    await expect(archiveCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "ALREADY_ARCHIVED" }),
    );
  });

  it("throws 404 when record not found (update empty, re-query empty)", async () => {
    const { db, chain } = mockDb();
    // update returns empty
    chain.returning.mockResolvedValueOnce([]);
    // re-query returns empty
    chain.limit.mockResolvedValueOnce([]);

    await expect(archiveCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

// ── deleteCheckInRecord ──────────────────────────────────────────────

describe("deleteCheckInRecord", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes a check-in record", async () => {
    const { db, chain } = mockDb();
    // existence check
    chain.limit.mockResolvedValueOnce([{ id: RECORD_ID }]);

    await deleteCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "check-in-record.deleted" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(deleteCheckInRecord(db, SYSTEM_ID, RECORD_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws 404 when record not found", async () => {
    const { db } = mockDb();

    await expect(
      deleteCheckInRecord(
        db,
        SYSTEM_ID,
        "cir_00000000-0000-4000-a000-000000000099" as CheckInRecordId,
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── parseCheckInRecordQuery ──────────────────────────────────────────

describe("parseCheckInRecordQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed options for valid query", () => {
    const result = parseCheckInRecordQuery({
      timerConfigId: TIMER_ID,
      pending: "true",
      includeArchived: "false",
    });

    expect(result.timerConfigId).toBe(TIMER_ID);
    expect(result.pending).toBe(true);
    expect(result.includeArchived).toBe(false);
  });

  it("returns defaults for empty query", () => {
    const result = parseCheckInRecordQuery({});

    expect(result.pending).toBe(false);
    expect(result.includeArchived).toBe(false);
    expect(result.timerConfigId).toBeUndefined();
  });

  it("throws 400 for invalid query parameters", () => {
    expect(() => parseCheckInRecordQuery({ pending: "not-a-boolean" })).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("parses optional timerConfigId", () => {
    const result = parseCheckInRecordQuery({ timerConfigId: undefined });

    expect(result.timerConfigId).toBeUndefined();
  });

  it("parses pending as false when not provided", () => {
    const result = parseCheckInRecordQuery({});

    expect(result.pending).toBe(false);
  });

  it("parses includeArchived as false when not provided", () => {
    const result = parseCheckInRecordQuery({});

    expect(result.includeArchived).toBe(false);
  });

  it("throws 400 for invalid timerConfigId format", () => {
    expect(() => parseCheckInRecordQuery({ timerConfigId: "invalid-id" })).toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });
});
