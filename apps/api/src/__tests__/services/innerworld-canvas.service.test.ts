import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";

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

const { InvalidInputError } = await import("@pluralscape/crypto");
const { getCanvas, upsertCanvas } = await import("../../services/innerworld-canvas.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeCanvasRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    systemId: SYSTEM_ID,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("getCanvas", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns the canvas for a valid system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeCanvasRow()]);

    const result = await getCanvas(db, SYSTEM_ID, AUTH);

    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.version).toBe(1);
    expect(typeof result.encryptedData).toBe("string");
  });

  it("throws 404 when canvas not found", async () => {
    const { db } = mockDb();

    await expect(getCanvas(db, SYSTEM_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(getCanvas(db, SYSTEM_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("upsertCanvas", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a new canvas when none exists (version=1)", async () => {
    const { db, chain } = mockDb();
    // No existing canvas
    chain.limit.mockResolvedValueOnce([]);
    chain.returning.mockResolvedValueOnce([makeCanvasRow()]);

    const result = await upsertCanvas(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.version).toBe(1);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "innerworld-canvas.created" }),
    );
  });

  it("updates an existing canvas with version increment", async () => {
    const { db, chain } = mockDb();
    // Existing canvas at version 1
    chain.limit.mockResolvedValueOnce([{ version: 1 }]);
    chain.returning.mockResolvedValueOnce([makeCanvasRow({ version: 2 })]);

    const result = await upsertCanvas(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "innerworld-canvas.updated" }),
    );
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    // Existing canvas at version 2, client sends version 1
    chain.limit.mockResolvedValueOnce([{ version: 2 }]);

    await expect(
      upsertCanvas(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 on first write with version > 1", async () => {
    const { db, chain } = mockDb();
    // No existing canvas
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      upsertCanvas(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 5 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(upsertCanvas(db, SYSTEM_ID, { bad: "data" }, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("throws 400 for malformed blob", async () => {
    const { db } = mockDb();
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new InvalidInputError("Invalid blob");
    });

    await expect(
      upsertCanvas(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      upsertCanvas(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
