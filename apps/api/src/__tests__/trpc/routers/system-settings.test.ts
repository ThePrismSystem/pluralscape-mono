import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { MOCK_SYSTEM_ID, makeCallerFactory, assertProcedureRateLimited } from "../test-helpers.js";

import type { EncryptedBase64, SystemSettingsId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
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

const createCaller = makeCallerFactory({ systemSettings: systemSettingsRouter });

const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZW1iZXI=";

const MOCK_SETTINGS_RESULT = {
  id: brandId<SystemSettingsId>("sset_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
  systemId: MOCK_SYSTEM_ID,
  locale: "en",
  biometricEnabled: false,
  encryptedData: "base64data==" as EncryptedBase64,
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

const MOCK_NOMENCLATURE_RESULT = {
  systemId: MOCK_SYSTEM_ID,
  encryptedData: "base64data==" as EncryptedBase64,
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("system-settings router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── settings.get ─────────────────────────────────────────────────

  describe("systemSettings.settings.get", () => {
    it("calls getSystemSettings with correct systemId and returns result", async () => {
      vi.mocked(getSystemSettings).mockResolvedValue(MOCK_SETTINGS_RESULT as never);
      const caller = createCaller();
      const result = await caller.systemSettings.settings.get({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(getSystemSettings)).toHaveBeenCalledOnce();
      expect(vi.mocked(getSystemSettings).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_SETTINGS_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.systemSettings.settings.get({ systemId: MOCK_SYSTEM_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getSystemSettings).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "System settings not found"),
      );
      const caller = createCaller();
      await expect(
        caller.systemSettings.settings.get({ systemId: MOCK_SYSTEM_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── settings.update ──────────────────────────────────────────────

  describe("systemSettings.settings.update", () => {
    it("calls updateSystemSettings with correct systemId and returns result", async () => {
      vi.mocked(updateSystemSettings).mockResolvedValue(MOCK_SETTINGS_RESULT as never);
      const caller = createCaller();
      const result = await caller.systemSettings.settings.update({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateSystemSettings)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateSystemSettings).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_SETTINGS_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateSystemSettings).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version conflict"),
      );
      const caller = createCaller();
      await expect(
        caller.systemSettings.settings.update({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── nomenclature.get ─────────────────────────────────────────────

  describe("systemSettings.nomenclature.get", () => {
    it("calls getNomenclatureSettings with correct systemId and returns result", async () => {
      vi.mocked(getNomenclatureSettings).mockResolvedValue(MOCK_NOMENCLATURE_RESULT);
      const caller = createCaller();
      const result = await caller.systemSettings.nomenclature.get({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(getNomenclatureSettings)).toHaveBeenCalledOnce();
      expect(vi.mocked(getNomenclatureSettings).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_NOMENCLATURE_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getNomenclatureSettings).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Nomenclature settings not found"),
      );
      const caller = createCaller();
      await expect(
        caller.systemSettings.nomenclature.get({ systemId: MOCK_SYSTEM_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── nomenclature.update ──────────────────────────────────────────

  describe("systemSettings.nomenclature.update", () => {
    it("calls updateNomenclatureSettings with correct systemId and returns result", async () => {
      vi.mocked(updateNomenclatureSettings).mockResolvedValue(MOCK_NOMENCLATURE_RESULT);
      const caller = createCaller();
      const result = await caller.systemSettings.nomenclature.update({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateNomenclatureSettings)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateNomenclatureSettings).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_NOMENCLATURE_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateNomenclatureSettings).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version conflict"),
      );
      const caller = createCaller();
      await expect(
        caller.systemSettings.nomenclature.update({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── pin.set ──────────────────────────────────────────────────────

  describe("systemSettings.pin.set", () => {
    it("calls setPin with correct systemId and returns success", async () => {
      vi.mocked(setPin).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.systemSettings.pin.set({ systemId: MOCK_SYSTEM_ID, pin: "1234" });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(setPin)).toHaveBeenCalledOnce();
      expect(vi.mocked(setPin).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(setPin).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "System settings not found"),
      );
      const caller = createCaller();
      await expect(
        caller.systemSettings.pin.set({ systemId: MOCK_SYSTEM_ID, pin: "1234" }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── pin.remove ───────────────────────────────────────────────────

  describe("systemSettings.pin.remove", () => {
    it("calls removePin with correct systemId and returns success", async () => {
      vi.mocked(removePin).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.systemSettings.pin.remove({
        systemId: MOCK_SYSTEM_ID,
        pin: "1234",
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(removePin)).toHaveBeenCalledOnce();
      expect(vi.mocked(removePin).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
    });

    it("surfaces ApiHttpError(401) as UNAUTHORIZED", async () => {
      vi.mocked(removePin).mockRejectedValue(
        new ApiHttpError(401, "INVALID_PIN", "PIN is incorrect"),
      );
      const caller = createCaller();
      await expect(
        caller.systemSettings.pin.remove({ systemId: MOCK_SYSTEM_ID, pin: "9999" }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  // ── pin.verify ───────────────────────────────────────────────────

  describe("systemSettings.pin.verify", () => {
    it("calls verifyPinCode with correct systemId and returns result", async () => {
      vi.mocked(verifyPinCode).mockResolvedValue({ verified: true });
      const caller = createCaller();
      const result = await caller.systemSettings.pin.verify({
        systemId: MOCK_SYSTEM_ID,
        pin: "1234",
      });

      expect(result).toEqual({ verified: true });
      expect(vi.mocked(verifyPinCode)).toHaveBeenCalledOnce();
      expect(vi.mocked(verifyPinCode).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
    });

    it("surfaces ApiHttpError(401) as UNAUTHORIZED when PIN is wrong", async () => {
      vi.mocked(verifyPinCode).mockRejectedValue(
        new ApiHttpError(401, "INVALID_PIN", "PIN is incorrect"),
      );
      const caller = createCaller();
      await expect(
        caller.systemSettings.pin.verify({ systemId: MOCK_SYSTEM_ID, pin: "9999" }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  // ── setup.getStatus ──────────────────────────────────────────────

  describe("systemSettings.setup.getStatus", () => {
    it("calls getSetupStatus with correct systemId and returns result", async () => {
      const mockStatus = {
        nomenclatureComplete: true,
        profileComplete: true,
        settingsCreated: true,
        recoveryKeyBackedUp: true,
        isComplete: true,
      };
      vi.mocked(getSetupStatus).mockResolvedValue(mockStatus);
      const caller = createCaller();
      const result = await caller.systemSettings.setup.getStatus({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(getSetupStatus)).toHaveBeenCalledOnce();
      expect(vi.mocked(getSetupStatus).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockStatus);
    });
  });

  // ── setup.nomenclatureStep ───────────────────────────────────────

  describe("systemSettings.setup.nomenclatureStep", () => {
    it("calls setupNomenclatureStep with correct systemId and returns result", async () => {
      vi.mocked(setupNomenclatureStep).mockResolvedValue({ success: true });
      const caller = createCaller();
      const result = await caller.systemSettings.setup.nomenclatureStep({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(setupNomenclatureStep)).toHaveBeenCalledOnce();
      expect(vi.mocked(setupNomenclatureStep).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
    });
  });

  // ── setup.profileStep ────────────────────────────────────────────

  describe("systemSettings.setup.profileStep", () => {
    it("calls setupProfileStep with correct systemId and returns result", async () => {
      vi.mocked(setupProfileStep).mockResolvedValue({ success: true });
      const caller = createCaller();
      const result = await caller.systemSettings.setup.profileStep({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(setupProfileStep)).toHaveBeenCalledOnce();
      expect(vi.mocked(setupProfileStep).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
    });
  });

  // ── setup.complete ───────────────────────────────────────────────

  describe("systemSettings.setup.complete", () => {
    it("calls setupComplete with correct systemId and returns result", async () => {
      vi.mocked(setupComplete).mockResolvedValue(MOCK_SETTINGS_RESULT as never);
      const caller = createCaller();
      const result = await caller.systemSettings.setup.complete({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        recoveryKeyBackupConfirmed: true,
      });

      expect(vi.mocked(setupComplete)).toHaveBeenCalledOnce();
      expect(vi.mocked(setupComplete).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_SETTINGS_RESULT);
    });

    it("surfaces ApiHttpError(400) as BAD_REQUEST when preconditions not met", async () => {
      vi.mocked(setupComplete).mockRejectedValue(
        new ApiHttpError(400, "PRECONDITION_FAILED", "Recovery key must be backed up"),
      );
      const caller = createCaller();
      await expect(
        caller.systemSettings.setup.complete({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          recoveryKeyBackupConfirmed: true,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(getSystemSettings).mockResolvedValue(MOCK_SETTINGS_RESULT as never);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.systemSettings.settings.get({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });
});
