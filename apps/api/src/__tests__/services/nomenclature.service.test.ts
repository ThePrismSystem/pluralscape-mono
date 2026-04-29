import { brandId } from "@pluralscape/types";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  serializeEncryptedBlob: vi.fn().mockReturnValue(new Uint8Array(32)),
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/encrypted-blob.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/encrypted-blob.js")>()),
  validateEncryptedBlob: vi
    .fn()
    .mockReturnValue({ ciphertext: new Uint8Array(16), nonce: new Uint8Array(12) }),
}));

vi.mock("@pluralscape/db/pg", () => ({
  nomenclatureSettings: { systemId: "systemId", version: "version" },
  systems: { id: "id", accountId: "accountId", archived: "archived" },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return { ...actual, now: vi.fn().mockReturnValue(1700000000000) };
});

vi.mock("@pluralscape/validation", () => ({
  UpdateNomenclatureBodySchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  eq: vi.fn((col: unknown, val: unknown) => ({ type: "eq", col, val })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}));

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { UpdateNomenclatureBodySchema } = await import("@pluralscape/validation");
const { getNomenclatureSettings, updateNomenclatureSettings } =
  await import("../../services/nomenclature.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const AUTH = makeTestAuth();

const SYSTEM_ID = brandId<SystemId>("sys_test");

const NOMENCLATURE_ROW = {
  systemId: SYSTEM_ID,
  encryptedData: { ciphertext: new Uint8Array(16), nonce: new Uint8Array(12) },
  version: 1,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

function mockSafeParseSuccess(data: Record<string, unknown>): void {
  const schema = vi.mocked(UpdateNomenclatureBodySchema);
  (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({ success: true, data });
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("nomenclature service", () => {
  const mockAudit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

  afterEach(() => {
    vi.restoreAllMocks();
    (mockAudit as ReturnType<typeof vi.fn>).mockClear();
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(getNomenclatureSettings(db, SYSTEM_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  describe("getNomenclatureSettings", () => {
    it("returns settings when found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([NOMENCLATURE_ROW]);

      const result = await getNomenclatureSettings(db, SYSTEM_ID, AUTH);

      expect(result.systemId).toBe(SYSTEM_ID);
      expect(result.version).toBe(1);
      expect(typeof result.encryptedData).toBe("string");
    });

    it("throws NOT_FOUND when settings don't exist", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(getNomenclatureSettings(db, SYSTEM_ID, AUTH)).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Nomenclature settings not found",
      });
    });
  });

  describe("updateNomenclatureSettings", () => {
    const VALID_PAYLOAD = {
      encryptedData: Buffer.from(new Uint8Array(32)).toString("base64"),
      version: 1,
    };

    beforeEach(() => {
      mockSafeParseSuccess(VALID_PAYLOAD);
    });

    it("returns updated settings on success", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([NOMENCLATURE_ROW]);

      const result = await updateNomenclatureSettings(
        db,
        SYSTEM_ID,
        VALID_PAYLOAD,
        AUTH,
        mockAudit,
      );

      expect(result.systemId).toBe(SYSTEM_ID);
      expect(result.version).toBe(1);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "settings.nomenclature-updated" }),
      );
    });

    it("throws CONFLICT on version mismatch", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ systemId: SYSTEM_ID }]);

      await expect(
        updateNomenclatureSettings(db, SYSTEM_ID, VALID_PAYLOAD, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Version conflict",
      });
    });

    it("throws NOT_FOUND when settings don't exist", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        updateNomenclatureSettings(db, SYSTEM_ID, VALID_PAYLOAD, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Nomenclature settings not found",
      });
    });

    it("throws BLOB_TOO_LARGE when encryptedData exceeds limit", async () => {
      const { validateEncryptedBlob } = await import("../../lib/encrypted-blob.js");
      const { ApiHttpError } = await import("../../lib/api-error.js");
      vi.mocked(validateEncryptedBlob).mockImplementationOnce(() => {
        throw new ApiHttpError(
          400,
          "BLOB_TOO_LARGE",
          "encryptedData exceeds maximum size of 65536 bytes",
        );
      });

      const { db } = mockDb();

      await expect(
        updateNomenclatureSettings(db, SYSTEM_ID, VALID_PAYLOAD, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "BLOB_TOO_LARGE",
      });
    });
  });
});
