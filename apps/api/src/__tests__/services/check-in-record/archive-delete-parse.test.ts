import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";

import { AUTH, RECORD_ID, SYSTEM_ID, TIMER_ID, makePendingRow } from "./internal.js";

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

const { archiveCheckInRecord } = await import("../../../services/check-in-record/archive.js");
const { deleteCheckInRecord } = await import("../../../services/check-in-record/delete.js");
const { parseCheckInRecordQuery } = await import("../../../services/check-in-record/list.js");
const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

// ── Tests ────────────────────────────────────────────────────────────

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
        brandId<CheckInRecordId>("cir_00000000-0000-4000-a000-000000000099"),
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

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

  it("parses pending row fixture correctly", () => {
    // Validate the makePendingRow fixture is compatible with the expected schema
    const row = makePendingRow();
    expect(row.systemId).toBe(SYSTEM_ID);
    expect(row.timerConfigId).toBe(TIMER_ID);
    expect(row.archived).toBe(false);
  });
});
