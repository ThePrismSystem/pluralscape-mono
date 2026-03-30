import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { FrontingReportId, SystemId } from "@pluralscape/types";

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
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const {
  createFrontingReport,
  updateFrontingReport,
  listFrontingReports,
  getFrontingReport,
  deleteFrontingReport,
  archiveFrontingReport,
  restoreFrontingReport,
} = await import("../../services/fronting-report.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const REPORT_ID = "fr_test-report" as FrontingReportId;

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function encodeTestCursor(generatedAt: number, id: string): string {
  return Buffer.from(JSON.stringify({ t: generatedAt, i: id })).toString("base64url");
}

function makeReportRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: REPORT_ID,
    systemId: SYSTEM_ID,
    encryptedData: new Uint8Array([1, 2, 3]),
    format: "html",
    generatedAt: 1000,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── createFrontingReport ─────────────────────────────────────────────

describe("createFrontingReport", () => {
  it("rejects unauthenticated access", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    await expect(
      createFrontingReport(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, format: "html", generatedAt: 1000 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("System not found");
  });

  it("creates a report and returns it", async () => {
    const { db, chain } = mockDb();
    const row = makeReportRow();
    chain.returning.mockResolvedValueOnce([row]);

    const result = await createFrontingReport(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, format: "html", generatedAt: 1000 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(REPORT_ID);
    expect(result.format).toBe("html");
    expect(result.version).toBe(1);
    expect(result.archived).toBe(false);
    expect(chain.insert).toHaveBeenCalledTimes(1);
  });

  it("writes an audit log entry", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeReportRow()]);

    await createFrontingReport(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, format: "pdf", generatedAt: 2000 },
      AUTH,
      mockAudit,
    );

    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "fronting-report.created" }),
    );
  });

  it("rejects invalid payload", async () => {
    const { db } = mockDb();
    await expect(
      createFrontingReport(db, SYSTEM_ID, { format: "html" }, AUTH, mockAudit),
    ).rejects.toThrow("Invalid payload");
  });

  it("throws when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createFrontingReport(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, format: "html", generatedAt: 1000 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("INSERT returned no rows");
  });
});

// ── updateFrontingReport ────────────────────────────────────────────

describe("updateFrontingReport", () => {
  it("rejects unauthenticated access", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    await expect(
      updateFrontingReport(
        db,
        SYSTEM_ID,
        REPORT_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("System not found");
  });

  it("updates a report and returns it", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeReportRow({ version: 2, updatedAt: 2000 });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateFrontingReport(
      db,
      SYSTEM_ID,
      REPORT_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(REPORT_ID);
    expect(result.version).toBe(2);
  });

  it("writes an audit log entry on update", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeReportRow({ version: 2 })]);

    await updateFrontingReport(
      db,
      SYSTEM_ID,
      REPORT_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "fronting-report.updated" }),
    );
  });

  it("throws 404 when report not found (version mismatch, entity gone)", async () => {
    const { db, chain } = mockDb();
    // OCC update returns empty
    chain.returning.mockResolvedValueOnce([]);
    // existsFn returns empty (not found)
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateFrontingReport(
        db,
        SYSTEM_ID,
        REPORT_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    // OCC update returns empty
    chain.returning.mockResolvedValueOnce([]);
    // existsFn returns the entity (exists but wrong version)
    chain.limit.mockResolvedValueOnce([{ id: REPORT_ID }]);

    await expect(
      updateFrontingReport(
        db,
        SYSTEM_ID,
        REPORT_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("rejects invalid payload", async () => {
    const { db } = mockDb();
    await expect(
      updateFrontingReport(db, SYSTEM_ID, REPORT_ID, { version: 1 }, AUTH, mockAudit),
    ).rejects.toThrow("Invalid payload");
  });
});

// ── listFrontingReports ──────────────────────────────────────────────

describe("listFrontingReports", () => {
  it("rejects unauthenticated access", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    await expect(listFrontingReports(db, SYSTEM_ID, AUTH)).rejects.toThrow("System not found");
  });

  it("returns empty list when no reports exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const result = await listFrontingReports(db, SYSTEM_ID, AUTH);
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("returns reports with pagination", async () => {
    const { db, chain } = mockDb();
    const rows = [makeReportRow({ id: "fr_report-1" }), makeReportRow({ id: "fr_report-2" })];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listFrontingReports(db, SYSTEM_ID, AUTH);
    expect(result.items).toHaveLength(2);
  });

  it("detects hasMore when more rows than limit", async () => {
    const { db, chain } = mockDb();
    const rows = [
      makeReportRow({ id: "fr_report-1", generatedAt: 3000 }),
      makeReportRow({ id: "fr_report-2", generatedAt: 2000 }),
      makeReportRow({ id: "fr_report-3", generatedAt: 1000 }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listFrontingReports(db, SYSTEM_ID, AUTH, { limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
  });

  it("returns nextCursor encoding generatedAt and id of last visible item", async () => {
    const { db, chain } = mockDb();
    const rows = [
      makeReportRow({ id: "fr_report-1", generatedAt: 3000 }),
      makeReportRow({ id: "fr_report-2", generatedAt: 2000 }),
      makeReportRow({ id: "fr_report-3", generatedAt: 1000 }),
    ];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listFrontingReports(db, SYSTEM_ID, AUTH, { limit: 2 });
    expect(result.nextCursor).not.toBeNull();

    const cursor = result.nextCursor;
    expect(cursor).not.toBeNull();
    const decoded: { t: number; i: string } = JSON.parse(
      Buffer.from(cursor as string, "base64url").toString("utf8"),
    );
    expect(decoded.t).toBe(2000);
    expect(decoded.i).toBe("fr_report-2");
  });

  it("applies cursor when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const cursor = encodeTestCursor(5000, "fr_test-cursor");
    await listFrontingReports(db, SYSTEM_ID, AUTH, { cursor });

    expect(chain.where).toHaveBeenCalled();
  });

  it("throws on malformed cursor", async () => {
    const { db } = mockDb();

    await expect(
      listFrontingReports(db, SYSTEM_ID, AUTH, { cursor: "not-valid-base64" }),
    ).rejects.toThrow("Malformed pagination cursor");
  });
});

// ── getFrontingReport ────────────────────────────────────────────────

describe("getFrontingReport", () => {
  it("rejects unauthenticated access", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    await expect(getFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH)).rejects.toThrow(
      "System not found",
    );
  });

  it("returns a report by ID", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeReportRow()]);

    const result = await getFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH);
    expect(result.id).toBe(REPORT_ID);
    expect(result.version).toBe(1);
  });

  it("throws 404 when report not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(getFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH)).rejects.toThrow(
      "Fronting report not found",
    );
  });
});

// ── deleteFrontingReport ─────────────────────────────────────────────

describe("deleteFrontingReport", () => {
  it("rejects unauthenticated access", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    await expect(deleteFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH, mockAudit)).rejects.toThrow(
      "System not found",
    );
  });

  it("deletes a report", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeReportRow()]);

    await deleteFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH, mockAudit);
    expect(chain.delete).toHaveBeenCalled();
  });

  it("writes an audit log entry", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeReportRow()]);

    await deleteFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH, mockAudit);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "fronting-report.deleted" }),
    );
  });

  it("throws 404 when report not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(deleteFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH, mockAudit)).rejects.toThrow(
      "Fronting report not found",
    );
  });
});

// ── archiveFrontingReport ────────────────────────────────────────────

describe("archiveFrontingReport", () => {
  it("rejects unauthenticated access", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    await expect(archiveFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH, mockAudit)).rejects.toThrow(
      "System not found",
    );
  });

  it("archives a report", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: REPORT_ID }]);

    await archiveFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH, mockAudit);
    expect(chain.update).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "fronting-report.archived" }),
    );
  });

  it("throws 404 when report not found", async () => {
    const { db, chain } = mockDb();
    // update().set().where() returns chain, then .returning() returns empty (no match)
    chain.returning.mockResolvedValueOnce([]);
    // existence check: select().from().where() resolves to empty
    chain.where
      .mockReturnValueOnce(chain) // update().set().where() — chains to .returning()
      .mockResolvedValueOnce([]); // select().from().where() — no entity

    await expect(archiveFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws ALREADY_ARCHIVED when report is already archived", async () => {
    const { db, chain } = mockDb();
    // update().set().where() returns chain, then .returning() returns empty
    chain.returning.mockResolvedValueOnce([]);
    // existence check: select().from().where() returns the entity
    chain.where
      .mockReturnValueOnce(chain) // update().set().where() — chains to .returning()
      .mockResolvedValueOnce([{ id: REPORT_ID }]); // select().from().where() — entity exists

    await expect(archiveFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "ALREADY_ARCHIVED" }),
    );
  });
});

// ── restoreFrontingReport ────────────────────────────────────────────

describe("restoreFrontingReport", () => {
  it("rejects unauthenticated access", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    await expect(restoreFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH, mockAudit)).rejects.toThrow(
      "System not found",
    );
  });

  it("restores an archived report", async () => {
    const { db, chain } = mockDb();
    const restoredRow = makeReportRow({ archived: false, archivedAt: null, version: 2 });
    chain.returning.mockResolvedValueOnce([restoredRow]);

    const result = await restoreFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH, mockAudit);
    expect(result.id).toBe(REPORT_ID);
    expect(result.archived).toBe(false);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "fronting-report.restored" }),
    );
  });

  it("throws 404 when archived report not found", async () => {
    const { db, chain } = mockDb();
    // update().set().where() returns chain, then .returning() returns empty
    chain.returning.mockResolvedValueOnce([]);
    // existence check: select().from().where() resolves to empty
    chain.where
      .mockReturnValueOnce(chain) // update().set().where() — chains to .returning()
      .mockResolvedValueOnce([]); // select().from().where() — no entity

    await expect(restoreFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws NOT_ARCHIVED when report is not archived", async () => {
    const { db, chain } = mockDb();
    // update().set().where() returns chain, then .returning() returns empty
    chain.returning.mockResolvedValueOnce([]);
    // existence check: select().from().where() returns the entity
    chain.where
      .mockReturnValueOnce(chain) // update().set().where() — chains to .returning()
      .mockResolvedValueOnce([{ id: REPORT_ID }]); // select().from().where() — entity exists

    await expect(restoreFrontingReport(db, SYSTEM_ID, REPORT_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "NOT_ARCHIVED" }),
    );
  });
});
