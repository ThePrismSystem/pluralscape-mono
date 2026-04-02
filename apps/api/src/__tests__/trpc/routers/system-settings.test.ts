import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../../trpc/context.js";
import type {
  AccountId,
  SessionId,
  SystemId,
  SystemSettingsId,
  UnixMillis,
} from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/system-settings.service.js", () => ({
  getSystemSettings: vi.fn(),
  updateSystemSettings: vi.fn(),
}));

vi.mock("../../../services/nomenclature.service.js", () => ({
  getNomenclatureSettings: vi.fn(),
  updateNomenclatureSettings: vi.fn(),
}));

vi.mock("../../../services/pin.service.js", () => ({
  setPin: vi.fn(),
  removePin: vi.fn(),
  verifyPinCode: vi.fn(),
}));

vi.mock("../../../services/setup.service.js", () => ({
  getSetupStatus: vi.fn(),
  setupNomenclatureStep: vi.fn(),
  setupProfileStep: vi.fn(),
  setupComplete: vi.fn(),
}));

const { getSystemSettings, updateSystemSettings } =
  await import("../../../services/system-settings.service.js");

const { getNomenclatureSettings, updateNomenclatureSettings } =
  await import("../../../services/nomenclature.service.js");

const { setPin, removePin, verifyPinCode } = await import("../../../services/pin.service.js");

const { getSetupStatus, setupNomenclatureStep, setupProfileStep, setupComplete } =
  await import("../../../services/setup.service.js");

const { systemSettingsRouter } = await import("../../../trpc/routers/system-settings.js");

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZW1iZXI=";

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test001" as AccountId,
  systemId: SYSTEM_ID,
  sessionId: "sess_test001" as SessionId,
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
  auditLogIpTracking: false,
};

const noopAuditWriter: AuditWriter = () => Promise.resolve();

function makeContext(auth: AuthContext | null): TRPCContext {
  return {
    db: {} as TRPCContext["db"],
    auth,
    createAudit: () => noopAuditWriter,
    requestMeta: { ipAddress: null, userAgent: null },
  };
}

function makeCaller(auth: AuthContext | null = MOCK_AUTH) {
  const appRouter = router({ systemSettings: systemSettingsRouter });
  const createCaller = createCallerFactory(appRouter);
  return createCaller(makeContext(auth));
}

const MOCK_SETTINGS_RESULT = {
  id: "sset_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as SystemSettingsId,
  systemId: SYSTEM_ID,
  locale: "en",
  biometricEnabled: false,
  encryptedData: "base64data==",
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

const MOCK_NOMENCLATURE_RESULT = {
  systemId: SYSTEM_ID,
  encryptedData: "base64data==",
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("system-settings router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getSettings ───────────────────────────────────────────────────

  describe("systemSettings.getSettings", () => {
    it("calls getSystemSettings with correct systemId and returns result", async () => {
      vi.mocked(getSystemSettings).mockResolvedValue(MOCK_SETTINGS_RESULT as never);
      const caller = makeCaller();
      const result = await caller.systemSettings.getSettings({ systemId: SYSTEM_ID });

      expect(vi.mocked(getSystemSettings)).toHaveBeenCalledOnce();
      expect(vi.mocked(getSystemSettings).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_SETTINGS_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(caller.systemSettings.getSettings({ systemId: SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getSystemSettings).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "System settings not found"),
      );
      const caller = makeCaller();
      await expect(caller.systemSettings.getSettings({ systemId: SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });
  });

  // ── updateSettings ────────────────────────────────────────────────

  describe("systemSettings.updateSettings", () => {
    it("calls updateSystemSettings with correct systemId and returns result", async () => {
      vi.mocked(updateSystemSettings).mockResolvedValue(MOCK_SETTINGS_RESULT as never);
      const caller = makeCaller();
      const result = await caller.systemSettings.updateSettings({
        systemId: SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateSystemSettings)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateSystemSettings).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_SETTINGS_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateSystemSettings).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version conflict"),
      );
      const caller = makeCaller();
      await expect(
        caller.systemSettings.updateSettings({
          systemId: SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── getNomenclature ───────────────────────────────────────────────

  describe("systemSettings.getNomenclature", () => {
    it("calls getNomenclatureSettings with correct systemId and returns result", async () => {
      vi.mocked(getNomenclatureSettings).mockResolvedValue(MOCK_NOMENCLATURE_RESULT);
      const caller = makeCaller();
      const result = await caller.systemSettings.getNomenclature({ systemId: SYSTEM_ID });

      expect(vi.mocked(getNomenclatureSettings)).toHaveBeenCalledOnce();
      expect(vi.mocked(getNomenclatureSettings).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_NOMENCLATURE_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getNomenclatureSettings).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Nomenclature settings not found"),
      );
      const caller = makeCaller();
      await expect(caller.systemSettings.getNomenclature({ systemId: SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });
  });

  // ── updateNomenclature ────────────────────────────────────────────

  describe("systemSettings.updateNomenclature", () => {
    it("calls updateNomenclatureSettings with correct systemId and returns result", async () => {
      vi.mocked(updateNomenclatureSettings).mockResolvedValue(MOCK_NOMENCLATURE_RESULT);
      const caller = makeCaller();
      const result = await caller.systemSettings.updateNomenclature({
        systemId: SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateNomenclatureSettings)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateNomenclatureSettings).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_NOMENCLATURE_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateNomenclatureSettings).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version conflict"),
      );
      const caller = makeCaller();
      await expect(
        caller.systemSettings.updateNomenclature({
          systemId: SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── setPin ────────────────────────────────────────────────────────

  describe("systemSettings.setPin", () => {
    it("calls setPin with correct systemId and returns success", async () => {
      vi.mocked(setPin).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.systemSettings.setPin({ systemId: SYSTEM_ID, pin: "1234" });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(setPin)).toHaveBeenCalledOnce();
      expect(vi.mocked(setPin).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(setPin).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "System settings not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.systemSettings.setPin({ systemId: SYSTEM_ID, pin: "1234" }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── removePin ─────────────────────────────────────────────────────

  describe("systemSettings.removePin", () => {
    it("calls removePin with correct systemId and returns success", async () => {
      vi.mocked(removePin).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.systemSettings.removePin({ systemId: SYSTEM_ID, pin: "1234" });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(removePin)).toHaveBeenCalledOnce();
      expect(vi.mocked(removePin).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
    });

    it("surfaces ApiHttpError(401) as UNAUTHORIZED", async () => {
      vi.mocked(removePin).mockRejectedValue(
        new ApiHttpError(401, "INVALID_PIN", "PIN is incorrect"),
      );
      const caller = makeCaller();
      await expect(
        caller.systemSettings.removePin({ systemId: SYSTEM_ID, pin: "9999" }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  // ── verifyPin ─────────────────────────────────────────────────────

  describe("systemSettings.verifyPin", () => {
    it("calls verifyPinCode with correct systemId and returns result", async () => {
      vi.mocked(verifyPinCode).mockResolvedValue({ verified: true });
      const caller = makeCaller();
      const result = await caller.systemSettings.verifyPin({ systemId: SYSTEM_ID, pin: "1234" });

      expect(result).toEqual({ verified: true });
      expect(vi.mocked(verifyPinCode)).toHaveBeenCalledOnce();
      expect(vi.mocked(verifyPinCode).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
    });

    it("surfaces ApiHttpError(401) as UNAUTHORIZED when PIN is wrong", async () => {
      vi.mocked(verifyPinCode).mockRejectedValue(
        new ApiHttpError(401, "INVALID_PIN", "PIN is incorrect"),
      );
      const caller = makeCaller();
      await expect(
        caller.systemSettings.verifyPin({ systemId: SYSTEM_ID, pin: "9999" }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  // ── getSetupStatus ────────────────────────────────────────────────

  describe("systemSettings.getSetupStatus", () => {
    it("calls getSetupStatus with correct systemId and returns result", async () => {
      const mockStatus = {
        nomenclatureComplete: true,
        profileComplete: true,
        settingsCreated: true,
        recoveryKeyBackedUp: true,
        isComplete: true,
      };
      vi.mocked(getSetupStatus).mockResolvedValue(mockStatus);
      const caller = makeCaller();
      const result = await caller.systemSettings.getSetupStatus({ systemId: SYSTEM_ID });

      expect(vi.mocked(getSetupStatus)).toHaveBeenCalledOnce();
      expect(vi.mocked(getSetupStatus).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockStatus);
    });
  });

  // ── setupNomenclatureStep ─────────────────────────────────────────

  describe("systemSettings.setupNomenclatureStep", () => {
    it("calls setupNomenclatureStep with correct systemId and returns result", async () => {
      vi.mocked(setupNomenclatureStep).mockResolvedValue({ success: true });
      const caller = makeCaller();
      const result = await caller.systemSettings.setupNomenclatureStep({
        systemId: SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(setupNomenclatureStep)).toHaveBeenCalledOnce();
      expect(vi.mocked(setupNomenclatureStep).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
    });
  });

  // ── setupProfileStep ──────────────────────────────────────────────

  describe("systemSettings.setupProfileStep", () => {
    it("calls setupProfileStep with correct systemId and returns result", async () => {
      vi.mocked(setupProfileStep).mockResolvedValue({ success: true });
      const caller = makeCaller();
      const result = await caller.systemSettings.setupProfileStep({
        systemId: SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(setupProfileStep)).toHaveBeenCalledOnce();
      expect(vi.mocked(setupProfileStep).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
    });
  });

  // ── setupComplete ─────────────────────────────────────────────────

  describe("systemSettings.setupComplete", () => {
    it("calls setupComplete with correct systemId and returns result", async () => {
      vi.mocked(setupComplete).mockResolvedValue(MOCK_SETTINGS_RESULT as never);
      const caller = makeCaller();
      const result = await caller.systemSettings.setupComplete({
        systemId: SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        recoveryKeyBackupConfirmed: true,
      });

      expect(vi.mocked(setupComplete)).toHaveBeenCalledOnce();
      expect(vi.mocked(setupComplete).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_SETTINGS_RESULT);
    });

    it("surfaces ApiHttpError(400) as BAD_REQUEST when preconditions not met", async () => {
      vi.mocked(setupComplete).mockRejectedValue(
        new ApiHttpError(400, "PRECONDITION_FAILED", "Recovery key must be backed up"),
      );
      const caller = makeCaller();
      await expect(
        caller.systemSettings.setupComplete({
          systemId: SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          recoveryKeyBackupConfirmed: true,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });
});
