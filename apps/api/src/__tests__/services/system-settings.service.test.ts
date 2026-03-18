import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  serializeEncryptedBlob: vi.fn().mockReturnValue(new Uint8Array(32)),
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/validate-encrypted-blob.js", () => ({
  validateEncryptedBlob: vi
    .fn()
    .mockReturnValue({ ciphertext: new Uint8Array(16), nonce: new Uint8Array(12) }),
}));

vi.mock("@pluralscape/db/pg", () => ({
  systemSettings: { id: "id", systemId: "systemId", version: "version" },
  systems: { id: "id", accountId: "accountId", archived: "archived" },
}));

vi.mock("@pluralscape/types", () => ({
  now: vi.fn().mockReturnValue(1700000000000),
}));

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

vi.mock("../../routes/systems/systems.constants.js", () => ({
  MAX_ENCRYPTED_DATA_BYTES: 65536,
}));

// ── Imports after mocks ──────────────────────────────────────────────

const { UpdateSystemSettingsBodySchema } = await import("@pluralscape/validation");
const { getSystemSettings, updateSystemSettings } =
  await import("../../services/system-settings.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_test" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
};

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
        expect.anything(),
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
      const { validateEncryptedBlob } = await import("../../lib/validate-encrypted-blob.js");
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
});
