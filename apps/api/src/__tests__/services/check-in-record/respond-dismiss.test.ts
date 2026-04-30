import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";

import {
  AUTH,
  MEMBER_ID,
  RECORD_ID,
  SYSTEM_ID,
  makeDismissedRow,
  makePendingRow,
  makeRespondedRow,
} from "./internal.js";

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

const { respondCheckInRecord } = await import("../../../services/check-in-record/respond.js");
const { dismissCheckInRecord } = await import("../../../services/check-in-record/dismiss.js");
const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

// ── Tests ────────────────────────────────────────────────────────────

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
