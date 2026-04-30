import { brandId } from "@pluralscape/types";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { VALID_BLOB_BASE64 } from "../../helpers/mock-crypto.js";
import { captureWhereArg, mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";
import {
  AUTH,
  MEMBER_ID,
  RECORD_ID,
  SYSTEM_ID,
  TIMER_ID,
  makeDismissedRow,
  makePendingRow,
  makeRespondedRow,
} from "./internal.js";

import type { MockChain } from "../../helpers/mock-db.js";
import type { CheckInRecordId } from "@pluralscape/types";

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

// ── Import under test ────────────────────────────────────────────────

const { createCheckInRecord } = await import("../../../services/check-in-record/create.js");
const { listCheckInRecords, parseCheckInRecordQuery } =
  await import("../../../services/check-in-record/list.js");
const { getCheckInRecord } = await import("../../../services/check-in-record/get.js");
const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

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

    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("returns pending records", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makePendingRow()]);

    const result = await listCheckInRecords(db, SYSTEM_ID, AUTH);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(RECORD_ID);
    expect(result.data[0]?.status).toBe("pending");
  });

  it("returns responded records with correct status", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeRespondedRow()]);

    const result = await listCheckInRecords(db, SYSTEM_ID, AUTH);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.status).toBe("responded");
    expect(result.data[0]?.respondedByMemberId).toBe(MEMBER_ID);
  });

  it("returns dismissed records with correct status", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeDismissedRow()]);

    const result = await listCheckInRecords(db, SYSTEM_ID, AUTH);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.status).toBe("dismissed");
    expect(result.data[0]?.dismissed).toBe(true);
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
    expect(result.data).toHaveLength(25);
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
        brandId<CheckInRecordId>("cir_00000000-0000-4000-a000-000000000099"),
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
