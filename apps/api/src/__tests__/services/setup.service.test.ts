import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId, UnixMillis } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  deserializeEncryptedBlob: vi
    .fn()
    .mockReturnValue({ ciphertext: new Uint8Array(16), nonce: new Uint8Array(12) }),
  serializeEncryptedBlob: vi.fn().mockReturnValue(new Uint8Array(32)),
  InvalidInputError: class InvalidInputError extends Error {
    override readonly name = "InvalidInputError" as const;
  },
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

vi.mock("@pluralscape/types", () => ({
  ID_PREFIXES: { systemSettings: "sset_" },
  createId: vi.fn().mockReturnValue("sset_new"),
  now: vi.fn().mockReturnValue(1700000000000),
}));

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

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  eq: vi.fn((col: unknown, val: unknown) => ({ type: "eq", col, val })),
}));

vi.mock("../../routes/systems/systems.constants.js", () => ({
  MAX_ENCRYPTED_DATA_BYTES: 65536,
}));

vi.mock("../../services/recovery-key.service.js", () => ({
  getRecoveryKeyStatus: vi.fn(),
}));

// ── Imports after mocks ──────────────────────────────────────────────

const { SetupCompleteBodySchema, SetupNomenclatureStepBodySchema, SetupProfileStepBodySchema } =
  await import("@pluralscape/validation");
const { getRecoveryKeyStatus } = await import("../../services/recovery-key.service.js");
const { getSetupStatus, setupNomenclatureStep, setupProfileStep, setupComplete } =
  await import("../../services/setup.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_test" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
};

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

  // ── getSetupStatus ────────────────────────────────────────────────

  describe("getSetupStatus", () => {
    it("returns all true when setup is fully complete", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ systemId: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ encryptedData: "data" }]);
      chain.limit.mockResolvedValueOnce([{ id: "ss_abc" }]);
      vi.mocked(getRecoveryKeyStatus).mockResolvedValueOnce({
        hasActiveKey: true,
        createdAt: 1700000000000 as UnixMillis,
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
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
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
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
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
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
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
        createdAt: 1700000000000 as UnixMillis,
      });
    });

    it("creates settings and returns result on success", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ systemId: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ encryptedData: "data" }]);
      chain.limit.mockResolvedValueOnce([]);
      chain.returning.mockResolvedValueOnce([SETTINGS_ROW]);

      const result = await setupComplete(db, SYSTEM_ID, VALID_PARAMS, AUTH, mockAudit);

      expect(result.id).toBe("ss_abc");
      expect(result.systemId).toBe(SYSTEM_ID);
      expect(mockAudit).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ eventType: "setup.completed" }),
      );
    });

    it("throws PRECONDITION_FAILED when recovery key is missing", async () => {
      vi.mocked(getRecoveryKeyStatus).mockResolvedValueOnce({
        hasActiveKey: false,
        createdAt: null,
      });

      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);

      await expect(
        setupComplete(db, SYSTEM_ID, VALID_PARAMS, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Recovery key must be backed up before completing setup",
      });
    });

    it("throws PRECONDITION_FAILED when nomenclature is missing", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
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
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
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
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ systemId: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ encryptedData: "data" }]);
      chain.limit.mockResolvedValueOnce([SETTINGS_ROW]);

      const result = await setupComplete(db, SYSTEM_ID, VALID_PARAMS, AUTH, mockAudit);

      expect(result.id).toBe("ss_abc");
      expect(mockAudit).not.toHaveBeenCalled();
    });
  });
});
