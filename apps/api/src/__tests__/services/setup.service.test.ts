import { toUnixMillis } from "@pluralscape/types";
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
  nomenclatureSettings: { systemId: "systemId" },
  systemSettings: { id: "id", systemId: "systemId" },
  systems: {
    id: "id",
    accountId: "accountId",
    archived: "archived",
    encryptedData: "encryptedData",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    ID_PREFIXES: { systemSettings: "sset_" },
    createId: vi.fn().mockReturnValue("sset_new"),
    now: vi.fn().mockReturnValue(1700000000000),
  };
});

vi.mock("@pluralscape/validation", () => ({
  SetupCompleteBodySchema: {
    safeParse: vi.fn(),
  },
  SetupNomenclatureStepBodySchema: {
    safeParse: vi.fn(),
  },
  SetupProfileStepBodySchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: "eq", col, val })),
  };
});

vi.mock("../../services/recovery-key.service.js", () => ({
  getRecoveryKeyStatus: vi.fn(),
}));

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { SetupCompleteBodySchema, SetupNomenclatureStepBodySchema, SetupProfileStepBodySchema } =
  await import("@pluralscape/validation");
const { getRecoveryKeyStatus } = await import("../../services/recovery-key.service.js");
const { getSetupStatus, setupNomenclatureStep, setupProfileStep, setupComplete } =
  await import("../../services/setup.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const AUTH = makeTestAuth();

const SYSTEM_ID = "sys_test" as SystemId;

const VALID_ENCRYPTED_DATA = Buffer.from(new Uint8Array(32)).toString("base64");

const SETTINGS_ROW = {
  id: "ss_abc",
  systemId: SYSTEM_ID,
  locale: null,
  biometricEnabled: false,
  encryptedData: { ciphertext: new Uint8Array(16), nonce: new Uint8Array(12) },
  version: 1,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

// ── Tests ─────────────────────────────────────────────────────────────

describe("setup service", () => {
  const mockAudit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

  afterEach(() => {
    vi.restoreAllMocks();
    (mockAudit as ReturnType<typeof vi.fn>).mockClear();
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(getSetupStatus(db, SYSTEM_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  // ── getSetupStatus ────────────────────────────────────────────────

  describe("getSetupStatus", () => {
    it("returns all true when setup is fully complete", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ systemId: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ encryptedData: "data" }]);
      chain.limit.mockResolvedValueOnce([{ id: "ss_abc" }]);
      vi.mocked(getRecoveryKeyStatus).mockResolvedValueOnce({
        hasActiveKey: true,
        createdAt: toUnixMillis(1700000000000),
      });

      const result = await getSetupStatus(db, SYSTEM_ID, AUTH);

      expect(result).toEqual({
        nomenclatureComplete: true,
        profileComplete: true,
        settingsCreated: true,
        recoveryKeyBackedUp: true,
        isComplete: true,
      });
    });

    it("returns correct flags when setup is incomplete", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ encryptedData: null }]);
      chain.limit.mockResolvedValueOnce([]);
      vi.mocked(getRecoveryKeyStatus).mockResolvedValueOnce({
        hasActiveKey: false,
        createdAt: null,
      });

      const result = await getSetupStatus(db, SYSTEM_ID, AUTH);

      expect(result).toEqual({
        nomenclatureComplete: false,
        profileComplete: false,
        settingsCreated: false,
        recoveryKeyBackedUp: false,
        isComplete: false,
      });
    });
  });

  // ── setupNomenclatureStep ─────────────────────────────────────────

  describe("setupNomenclatureStep", () => {
    const VALID_PARAMS = { encryptedData: VALID_ENCRYPTED_DATA };

    beforeEach(() => {
      const schema = vi.mocked(SetupNomenclatureStepBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        data: VALID_PARAMS,
      });
    });

    it("upserts and returns success", async () => {
      const { db, chain } = mockDb();
      const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
      chain.values.mockReturnValue({ onConflictDoUpdate });

      const result = await setupNomenclatureStep(db, SYSTEM_ID, VALID_PARAMS, AUTH, mockAudit);

      expect(result).toEqual({ success: true });
      expect(mockAudit).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ eventType: "setup.step-completed", detail: "nomenclature" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const schema = vi.mocked(SetupNomenclatureStepBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: false,
        error: { issues: [] },
      });

      const { db } = mockDb();

      await expect(setupNomenclatureStep(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toMatchObject(
        {
          code: "VALIDATION_ERROR",
          message: "Invalid nomenclature payload",
        },
      );
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
        setupNomenclatureStep(
          db,
          SYSTEM_ID,
          { encryptedData: VALID_ENCRYPTED_DATA },
          AUTH,
          mockAudit,
        ),
      ).rejects.toMatchObject({
        code: "BLOB_TOO_LARGE",
      });
    });
  });

  // ── setupProfileStep ──────────────────────────────────────────────

  describe("setupProfileStep", () => {
    const VALID_PARAMS = { encryptedData: VALID_ENCRYPTED_DATA };

    beforeEach(() => {
      const schema = vi.mocked(SetupProfileStepBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        data: VALID_PARAMS,
      });
    });

    it("updates profile and returns success", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ id: SYSTEM_ID }]);

      const result = await setupProfileStep(db, SYSTEM_ID, VALID_PARAMS, AUTH, mockAudit);

      expect(result).toEqual({ success: true });
      expect(mockAudit).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ eventType: "setup.step-completed", detail: "profile" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const schema = vi.mocked(SetupProfileStepBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: false,
        error: { issues: [] },
      });

      const { db } = mockDb();

      await expect(setupProfileStep(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: "Invalid profile payload",
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
        setupProfileStep(db, SYSTEM_ID, { encryptedData: VALID_ENCRYPTED_DATA }, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "BLOB_TOO_LARGE",
      });
    });
  });

  // ── setupComplete ─────────────────────────────────────────────────

  describe("setupComplete", () => {
    const VALID_PARAMS = { encryptedData: VALID_ENCRYPTED_DATA };

    beforeEach(() => {
      const schema = vi.mocked(SetupCompleteBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        data: VALID_PARAMS,
      });

      vi.mocked(getRecoveryKeyStatus).mockResolvedValue({
        hasActiveKey: true,
        createdAt: toUnixMillis(1700000000000),
      });
    });

    it("creates settings and returns result on success", async () => {
      const { db, chain } = mockDb();
      // Precondition checks: nomenclature, system profile
      chain.limit.mockResolvedValueOnce([{ systemId: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ encryptedData: "data" }]);
      // Transaction: insert with onConflictDoNothing
      const onConflictDoNothing = vi.fn().mockReturnValue(chain);
      chain.values.mockReturnValueOnce({ onConflictDoNothing });
      chain.returning.mockResolvedValueOnce([SETTINGS_ROW]);

      const result = await setupComplete(db, SYSTEM_ID, VALID_PARAMS, AUTH, mockAudit);

      expect(result.id).toBe("ss_abc");
      expect(result.systemId).toBe(SYSTEM_ID);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "setup.completed" }),
      );
    });

    it("throws PRECONDITION_FAILED when recovery key is missing", async () => {
      vi.mocked(getRecoveryKeyStatus).mockResolvedValueOnce({
        hasActiveKey: false,
        createdAt: null,
      });

      const { db } = mockDb();

      await expect(
        setupComplete(db, SYSTEM_ID, VALID_PARAMS, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Recovery key must be backed up before completing setup",
      });
    });

    it("throws PRECONDITION_FAILED when nomenclature is missing", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ encryptedData: "data" }]);

      await expect(
        setupComplete(db, SYSTEM_ID, VALID_PARAMS, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Nomenclature must be configured before completing setup",
      });
    });

    it("throws PRECONDITION_FAILED when profile is missing", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ systemId: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ encryptedData: null }]);

      await expect(
        setupComplete(db, SYSTEM_ID, VALID_PARAMS, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "System profile must be configured before completing setup",
      });
    });

    it("returns existing settings when already created (idempotent)", async () => {
      const { db, chain } = mockDb();
      // Precondition checks
      chain.limit.mockResolvedValueOnce([{ systemId: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ encryptedData: "data" }]);
      // Transaction: insert returns empty (conflict)
      const onConflictDoNothing = vi.fn().mockReturnValue(chain);
      chain.values.mockReturnValueOnce({ onConflictDoNothing });
      chain.returning.mockResolvedValueOnce([]);
      // Then select existing
      chain.limit.mockResolvedValueOnce([SETTINGS_ROW]);

      const result = await setupComplete(db, SYSTEM_ID, VALID_PARAMS, AUTH, mockAudit);

      expect(result.id).toBe("ss_abc");
      expect(mockAudit).not.toHaveBeenCalled();
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

      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ systemId: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ encryptedData: "data" }]);

      await expect(
        setupComplete(db, SYSTEM_ID, VALID_PARAMS, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "BLOB_TOO_LARGE",
      });
    });
  });
});
