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
  systemSettings: { id: "id", systemId: "systemId", version: "version" },
  systems: { id: "id", accountId: "accountId", archived: "archived" },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return { ...actual, now: vi.fn().mockReturnValue(1700000000000) };
});

vi.mock("@pluralscape/validation", () => ({
  UpdateSystemSettingsBodySchema: {
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
const { UpdateSystemSettingsBodySchema } = await import("@pluralscape/validation");
const { clearSettingsCache, getSystemSettings, updateSystemSettings } =
  await import("../../services/system-settings.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const AUTH = makeTestAuth();

const SYSTEM_ID = "sys_test" as SystemId;

const SETTINGS_ROW = {
  id: "ss_abc",
  systemId: SYSTEM_ID,
  locale: "en-US",
  biometricEnabled: false,
  encryptedData: { ciphertext: new Uint8Array(16), nonce: new Uint8Array(12) },
  version: 1,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

function mockSafeParseSuccess(data: Record<string, unknown>): void {
  const schema = vi.mocked(UpdateSystemSettingsBodySchema);
  (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({ success: true, data });
}

function mockSafeParseFailure(): void {
  const schema = vi.mocked(UpdateSystemSettingsBodySchema);
  (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
    success: false,
    error: { issues: [] },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("system-settings service", () => {
  const mockAudit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

  afterEach(() => {
    vi.restoreAllMocks();
    (mockAudit as ReturnType<typeof vi.fn>).mockClear();
    clearSettingsCache();
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(getSystemSettings(db, SYSTEM_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  // ── getSystemSettings ─────────────────────────────────────────────

  describe("getSystemSettings", () => {
    it("returns settings when found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([SETTINGS_ROW]);

      const result = await getSystemSettings(db, SYSTEM_ID, AUTH);

      expect(result.id).toBe("ss_abc");
      expect(result.systemId).toBe(SYSTEM_ID);
      expect(result.version).toBe(1);
      expect(typeof result.encryptedData).toBe("string");
    });

    it("throws NOT_FOUND when settings don't exist", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(getSystemSettings(db, SYSTEM_ID, AUTH)).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "System settings not found",
      });
    });
  });

  // ── updateSystemSettings ──────────────────────────────────────────

  describe("updateSystemSettings", () => {
    const VALID_PAYLOAD = {
      encryptedData: Buffer.from(new Uint8Array(32)).toString("base64"),
      version: 1,
    };

    beforeEach(() => {
      mockSafeParseSuccess(VALID_PAYLOAD);
    });

    it("returns updated settings on success", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([SETTINGS_ROW]);

      const result = await updateSystemSettings(db, SYSTEM_ID, VALID_PAYLOAD, AUTH, mockAudit);

      expect(result.id).toBe("ss_abc");
      expect(result.version).toBe(1);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "settings.changed" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      mockSafeParseFailure();
      const { db } = mockDb();

      await expect(updateSystemSettings(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: "Invalid settings payload",
      });
    });

    it("throws CONFLICT on version mismatch", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ id: "ss_abc" }]);

      await expect(
        updateSystemSettings(db, SYSTEM_ID, VALID_PAYLOAD, AUTH, mockAudit),
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
        updateSystemSettings(db, SYSTEM_ID, VALID_PAYLOAD, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "System settings not found",
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
        updateSystemSettings(db, SYSTEM_ID, VALID_PAYLOAD, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "BLOB_TOO_LARGE",
      });
    });
  });

  // ── Cache lifecycle ──────────────────────────────────────────────

  describe("settings cache lifecycle", () => {
    const VALID_PAYLOAD = {
      encryptedData: Buffer.from(new Uint8Array(32)).toString("base64"),
      version: 1,
    };

    beforeEach(() => {
      mockSafeParseSuccess(VALID_PAYLOAD);
    });

    it("caches get results and invalidates on update", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValue([SETTINGS_ROW]);

      // First call — cache miss, hits DB
      await getSystemSettings(db, SYSTEM_ID, AUTH);
      expect(chain.limit).toHaveBeenCalledTimes(1);

      // Second call — cache hit, no additional DB call
      await getSystemSettings(db, SYSTEM_ID, AUTH);
      expect(chain.limit).toHaveBeenCalledTimes(1);

      // Write operation — invalidates cache
      chain.returning.mockResolvedValueOnce([SETTINGS_ROW]);
      await updateSystemSettings(db, SYSTEM_ID, VALID_PAYLOAD, AUTH, mockAudit);

      // Third call — cache miss after invalidation, hits DB again
      chain.limit.mockResolvedValueOnce([SETTINGS_ROW]);
      await getSystemSettings(db, SYSTEM_ID, AUTH);
      expect(chain.limit).toHaveBeenCalledTimes(2);
    });
  });
});
