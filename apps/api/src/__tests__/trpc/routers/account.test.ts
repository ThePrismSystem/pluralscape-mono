import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MOCK_SYSTEM_ID,
  MOCK_AUTH,
  noopAuditWriter,
  makeCallerFactory,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { BiometricTokenId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../trpc/middlewares/rate-limit.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../trpc/middlewares/rate-limit.js")>();
  const { middleware: mw } = await import("../../../trpc/trpc.js");
  return {
    ...actual,
    createTRPCRateLimiter: vi.fn().mockImplementation(() => mw(({ next }) => next())),
  };
});

vi.mock("../../../services/account/queries.js", () => ({
  getAccountInfo: vi.fn(),
}));

vi.mock("../../../services/account/update.js", () => ({
  changeEmail: vi.fn(),
  changePassword: vi.fn(),
  updateAccountSettings: vi.fn(),
}));

vi.mock("../../../services/account/notifications.js", () => ({
  enqueueAccountEmailChangedNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/account-pin.service.js", () => ({
  setAccountPin: vi.fn(),
  removeAccountPin: vi.fn(),
  verifyAccountPin: vi.fn(),
}));

vi.mock("../../../services/biometric.service.js", () => ({
  enrollBiometric: vi.fn(),
  verifyBiometric: vi.fn(),
}));

vi.mock("../../../services/recovery-key.service.js", () => ({
  getRecoveryKeyStatus: vi.fn(),
  regenerateRecoveryKeyBackup: vi.fn(),
}));

vi.mock("../../../services/audit-log-query.service.js", () => ({
  queryAuditLog: vi.fn(),
}));

vi.mock("../../../services/account-deletion.service.js", () => ({
  deleteAccount: vi.fn(),
}));

vi.mock("../../../services/device-transfer/initiate.js", () => ({
  initiateTransfer: vi.fn(),
}));

vi.mock("../../../services/device-transfer/approve.js", () => ({
  approveTransfer: vi.fn(),
}));

vi.mock("../../../services/device-transfer/complete.js", () => ({
  completeTransfer: vi.fn(),
}));

const { getAccountInfo } = await import("../../../services/account/queries.js");
const { changeEmail, changePassword, updateAccountSettings } =
  await import("../../../services/account/update.js");
const { enqueueAccountEmailChangedNotification } =
  await import("../../../services/account/notifications.js");
const { setAccountPin, removeAccountPin, verifyAccountPin } =
  await import("../../../services/account-pin.service.js");
const { enrollBiometric, verifyBiometric } = await import("../../../services/biometric.service.js");
const { getRecoveryKeyStatus, regenerateRecoveryKeyBackup } =
  await import("../../../services/recovery-key.service.js");
const { queryAuditLog } = await import("../../../services/audit-log-query.service.js");
const { initiateTransfer } = await import("../../../services/device-transfer/initiate.js");
const { approveTransfer } = await import("../../../services/device-transfer/approve.js");
const { completeTransfer } = await import("../../../services/device-transfer/complete.js");
const {
  TransferValidationError,
  TransferNotFoundError,
  TransferCodeError,
  TransferExpiredError,
  KeyDerivationUnavailableError,
  TransferSessionMismatchError,
} = await import("../../../services/device-transfer/errors.js");

const { accountRouter } = await import("../../../trpc/routers/account.js");

const createCaller = makeCallerFactory({ account: accountRouter });

const MOCK_TIMESTAMP = 1_700_000_000_000 as UnixMillis;

describe("account router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── get ───────────────────────────────────────────────────────

  describe("account.get", () => {
    const mockAccountInfo = {
      accountId: MOCK_AUTH.accountId,
      accountType: "system" as const,
      systemId: MOCK_SYSTEM_ID,
      auditLogIpTracking: false,
      version: 1,
      createdAt: MOCK_TIMESTAMP,
      updatedAt: MOCK_TIMESTAMP,
    };

    it("returns account info for authenticated caller", async () => {
      vi.mocked(getAccountInfo).mockResolvedValue(mockAccountInfo);
      const caller = createCaller();
      const result = await caller.account.get();
      expect(result).toEqual(mockAccountInfo);
      expect(vi.mocked(getAccountInfo)).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_AUTH.accountId,
      );
    });

    it("throws NOT_FOUND when account does not exist", async () => {
      vi.mocked(getAccountInfo).mockResolvedValue(null);
      const caller = createCaller();
      await expect(caller.account.get()).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.get()).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── changeEmail ───────────────────────────────────────────────────

  describe("account.changeEmail", () => {
    const input = {
      email: "new@example.com",
      authKey: "ab".repeat(32),
    };

    it("calls changeEmail and returns ok (no leaked addresses)", async () => {
      vi.mocked(changeEmail).mockResolvedValue({
        kind: "changed",
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        version: 5,
      });
      const caller = createCaller();
      const result = await caller.account.changeEmail(input);
      // Response carries { ok: true } only — old/new plaintext addresses
      // are intentionally not leaked back to callers.
      expect(result).toEqual({ ok: true });
      expect(vi.mocked(changeEmail)).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_AUTH.accountId,
        input,
        noopAuditWriter,
      );
      const helperMock = vi.mocked(enqueueAccountEmailChangedNotification);
      expect(helperMock).toHaveBeenCalledTimes(1);
      // Avoid pretty-format introspection of the Proxy db (which throws on
      // every property access) by reading the recorded call positionally
      // rather than via toHaveBeenCalledWith.
      const call = helperMock.mock.calls[0];
      if (!call) throw new Error("expected helper to be called once");
      expect(call[1]).toBe(noopAuditWriter);
      expect(call[3]).toEqual({
        accountId: MOCK_AUTH.accountId,
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        version: 5,
        ipAddress: null,
      });
    });

    it("skips the notification helper on kind:'noop'", async () => {
      vi.mocked(enqueueAccountEmailChangedNotification).mockClear();
      vi.mocked(changeEmail).mockResolvedValue({ kind: "noop" });
      const caller = createCaller();
      const result = await caller.account.changeEmail(input);
      expect(result).toEqual({ ok: true });
      expect(vi.mocked(enqueueAccountEmailChangedNotification)).not.toHaveBeenCalled();
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.changeEmail(input)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("rejects invalid email format", async () => {
      const caller = createCaller();
      await expect(
        caller.account.changeEmail({ email: "not-an-email", authKey: "ab".repeat(32) }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── changePassword ────────────────────────────────────────────────

  describe("account.changePassword", () => {
    const input = {
      oldAuthKey: "ab".repeat(32),
      newAuthKey: "cd".repeat(32),
      newKdfSalt: "ef".repeat(16),
      newEncryptedMasterKey: "11".repeat(72),
      challengeSignature: "22".repeat(64),
    };

    const changePasswordResult = {
      ok: true as const,
      revokedSessionCount: 2,
      sessionRevoked: true,
    };

    it("calls changePassword and returns result", async () => {
      vi.mocked(changePassword).mockResolvedValue(changePasswordResult);
      const caller = createCaller();
      const result = await caller.account.changePassword(input);
      expect(result).toEqual(changePasswordResult);
      expect(vi.mocked(changePassword)).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_AUTH.accountId,
        input,
        noopAuditWriter,
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.changePassword(input)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── updateSettings ────────────────────────────────────────────────

  describe("account.updateSettings", () => {
    const input = { auditLogIpTracking: true, version: 1 };
    const settingsResult = { ok: true as const, auditLogIpTracking: true, version: 2 };

    it("calls updateAccountSettings and returns result", async () => {
      vi.mocked(updateAccountSettings).mockResolvedValue(settingsResult);
      const caller = createCaller();
      const result = await caller.account.updateSettings(input);
      expect(result).toEqual(settingsResult);
      expect(vi.mocked(updateAccountSettings)).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_AUTH.accountId,
        input,
        noopAuditWriter,
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.updateSettings(input)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── setPin ────────────────────────────────────────────────────────

  describe("account.setPin", () => {
    const input = { pin: "123456" };

    it("calls setAccountPin and returns ok", async () => {
      vi.mocked(setAccountPin).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.account.setPin(input);
      expect(result).toEqual({ success: true });
      expect(vi.mocked(setAccountPin)).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_AUTH.accountId,
        input,
        noopAuditWriter,
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.setPin(input)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── removePin ─────────────────────────────────────────────────────

  describe("account.removePin", () => {
    const input = { pin: "123456" };

    it("calls removeAccountPin and returns ok", async () => {
      vi.mocked(removeAccountPin).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.account.removePin(input);
      expect(result).toEqual({ success: true });
      expect(vi.mocked(removeAccountPin)).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_AUTH.accountId,
        input,
        noopAuditWriter,
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.removePin(input)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── verifyPin ─────────────────────────────────────────────────────

  describe("account.verifyPin", () => {
    const input = { pin: "123456" };

    it("calls verifyAccountPin and returns verified", async () => {
      vi.mocked(verifyAccountPin).mockResolvedValue({ verified: true });
      const caller = createCaller();
      const result = await caller.account.verifyPin(input);
      expect(result).toEqual({ verified: true });
      expect(vi.mocked(verifyAccountPin)).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_AUTH.accountId,
        input,
        noopAuditWriter,
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.verifyPin(input)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── enrollBiometric ───────────────────────────────────────────────

  describe("account.enrollBiometric", () => {
    const input = { token: "biometric-token-value" };

    it("calls enrollBiometric with auth context and returns id", async () => {
      const mockId = brandId<BiometricTokenId>("btok_abc123");
      vi.mocked(enrollBiometric).mockResolvedValue({ id: mockId });
      const caller = createCaller();
      const result = await caller.account.enrollBiometric(input);
      expect(result).toEqual({ id: mockId });
      expect(vi.mocked(enrollBiometric)).toHaveBeenCalledWith(
        expect.anything(),
        input,
        MOCK_AUTH,
        noopAuditWriter,
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.enrollBiometric(input)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── verifyBiometric ───────────────────────────────────────────────

  describe("account.verifyBiometric", () => {
    const input = { token: "biometric-token-value" };

    it("calls verifyBiometric with auth context and returns verified", async () => {
      vi.mocked(verifyBiometric).mockResolvedValue({ verified: true });
      const caller = createCaller();
      const result = await caller.account.verifyBiometric(input);
      expect(result).toEqual({ verified: true });
      expect(vi.mocked(verifyBiometric)).toHaveBeenCalledWith(
        expect.anything(),
        input,
        MOCK_AUTH,
        noopAuditWriter,
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.verifyBiometric(input)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── getRecoveryKeyStatus ──────────────────────────────────────────

  describe("account.getRecoveryKeyStatus", () => {
    it("returns active key status", async () => {
      const mockStatus = { hasActiveKey: true as const, createdAt: MOCK_TIMESTAMP };
      vi.mocked(getRecoveryKeyStatus).mockResolvedValue(mockStatus);
      const caller = createCaller();
      const result = await caller.account.getRecoveryKeyStatus();
      expect(result).toEqual(mockStatus);
      expect(vi.mocked(getRecoveryKeyStatus)).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_AUTH.accountId,
      );
    });

    it("returns no-key status", async () => {
      vi.mocked(getRecoveryKeyStatus).mockResolvedValue({ hasActiveKey: false, createdAt: null });
      const caller = createCaller();
      const result = await caller.account.getRecoveryKeyStatus();
      expect(result).toEqual({ hasActiveKey: false, createdAt: null });
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.getRecoveryKeyStatus()).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── regenerateRecoveryKey ─────────────────────────────────────────

  describe("account.regenerateRecoveryKey", () => {
    const input = {
      authKey: "ab".repeat(32),
      newRecoveryEncryptedMasterKey: "cc".repeat(72),
      recoveryKeyHash: "dd".repeat(32),
      confirmed: true as const,
    };

    it("calls regenerateRecoveryKeyBackup and returns recovery key", async () => {
      vi.mocked(regenerateRecoveryKeyBackup).mockResolvedValue({ ok: true });
      const caller = createCaller();
      const result = await caller.account.regenerateRecoveryKey(input);
      expect(result).toEqual({ ok: true });
      expect(vi.mocked(regenerateRecoveryKeyBackup)).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_AUTH.accountId,
        input,
        noopAuditWriter,
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.regenerateRecoveryKey(input)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── queryAuditLog ─────────────────────────────────────────────────

  describe("account.queryAuditLog", () => {
    const mockAuditResult = {
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    };

    it("returns paginated audit log", async () => {
      vi.mocked(queryAuditLog).mockResolvedValue(mockAuditResult);
      const caller = createCaller();
      const result = await caller.account.queryAuditLog({ limit: 25 });
      expect(result).toEqual(mockAuditResult);
      expect(vi.mocked(queryAuditLog)).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_AUTH.accountId,
        expect.objectContaining({ limit: 25 }),
      );
    });

    it("passes event_type and resource_type filters", async () => {
      vi.mocked(queryAuditLog).mockResolvedValue(mockAuditResult);
      const caller = createCaller();
      await caller.account.queryAuditLog({
        event_type: "auth.login",
        resource_type: "auth",
        limit: 10,
      });

      const callParams = vi.mocked(queryAuditLog).mock.calls[0]?.[2];
      expect(callParams?.eventType).toBe("auth.login");
      expect(callParams?.resourceType).toBe("auth");
      expect(callParams?.limit).toBe(10);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.queryAuditLog({ limit: 25 })).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("rejects limit exceeding maximum", async () => {
      const caller = createCaller();
      await expect(caller.account.queryAuditLog({ limit: 500 })).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(getAccountInfo).mockResolvedValue({
      accountId: MOCK_AUTH.accountId,
      accountType: "system" as const,
      systemId: MOCK_SYSTEM_ID,
      auditLogIpTracking: false,
      version: 1,
      createdAt: 1_700_000_000_000 as import("@pluralscape/types").UnixMillis,
      updatedAt: 1_700_000_000_000 as import("@pluralscape/types").UnixMillis,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.account.get(),
      "authLight",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(changeEmail).mockResolvedValue({ kind: "noop" });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.account.changeEmail({ email: "new@example.com", authKey: "ab".repeat(32) }),
      "authHeavy",
    );
  });

  // ── deleteAccount ─────────────────────────────────────────────────

  describe("account.deleteAccount", () => {
    const input = { authKey: "aa".repeat(32) };

    it("calls deleteAccount service and returns success", async () => {
      const { deleteAccount: deleteAccountSvc } =
        await import("../../../services/account-deletion.service.js");
      vi.mocked(deleteAccountSvc).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.account.deleteAccount(input);
      expect(result).toEqual({ success: true });
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.deleteAccount(input)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── initiateDeviceTransfer ────────────────────────────────────────

  describe("account.initiateDeviceTransfer", () => {
    // 32 hex chars (PWHASH_SALT_BYTES=16 * HEX_CHARS_PER_BYTE=2)
    const VALID_CODE_SALT = "a".repeat(32);
    // 80 hex chars ((AEAD_NONCE_BYTES=24 + AEAD_TAG_BYTES=16) * 2)
    const VALID_ENC_KEY = "b".repeat(80);

    const validInput = {
      codeSaltHex: VALID_CODE_SALT,
      encryptedKeyMaterialHex: VALID_ENC_KEY,
    };

    const mockTransferResult = {
      transferId: "xfer_001",
      expiresAt: 1_700_003_600_000 as import("@pluralscape/types").UnixMillis,
    };

    it("returns transfer result on success", async () => {
      vi.mocked(initiateTransfer).mockResolvedValue(mockTransferResult);
      const caller = createCaller();
      const result = await caller.account.initiateDeviceTransfer(validInput);
      expect(result).toEqual(mockTransferResult);
    });

    it("maps TransferValidationError to BAD_REQUEST", async () => {
      vi.mocked(initiateTransfer).mockRejectedValue(new TransferValidationError("bad"));
      const caller = createCaller();
      await expect(caller.account.initiateDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });

    it("surfaces unknown errors as INTERNAL_SERVER_ERROR", async () => {
      vi.mocked(initiateTransfer).mockRejectedValue(new Error("unexpected"));
      const caller = createCaller();
      await expect(caller.account.initiateDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "INTERNAL_SERVER_ERROR" }),
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.initiateDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── approveDeviceTransfer ─────────────────────────────────────────

  describe("account.approveDeviceTransfer", () => {
    const validInput = { transferId: "xfer_001" };

    it("returns success on approval", async () => {
      vi.mocked(approveTransfer).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.account.approveDeviceTransfer(validInput);
      expect(result).toEqual({ success: true });
    });

    it("maps TransferNotFoundError to NOT_FOUND", async () => {
      vi.mocked(approveTransfer).mockRejectedValue(new TransferNotFoundError("not found"));
      const caller = createCaller();
      await expect(caller.account.approveDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });

    it("maps TransferSessionMismatchError to FORBIDDEN", async () => {
      vi.mocked(approveTransfer).mockRejectedValue(new TransferSessionMismatchError("forbidden"));
      const caller = createCaller();
      await expect(caller.account.approveDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "FORBIDDEN" }),
      );
    });

    it("surfaces unknown errors as INTERNAL_SERVER_ERROR", async () => {
      vi.mocked(approveTransfer).mockRejectedValue(new Error("unexpected"));
      const caller = createCaller();
      await expect(caller.account.approveDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "INTERNAL_SERVER_ERROR" }),
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.approveDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── completeDeviceTransfer ────────────────────────────────────────

  describe("account.completeDeviceTransfer", () => {
    const validInput = { transferId: "xfer_001", code: "1234567890" };
    const mockCompleteResult = { encryptedKeyMaterialHex: "deadbeef".repeat(10) };

    it("returns complete result on success", async () => {
      vi.mocked(completeTransfer).mockResolvedValue(mockCompleteResult);
      const caller = createCaller();
      const result = await caller.account.completeDeviceTransfer(validInput);
      expect(result).toEqual(mockCompleteResult);
    });

    it("maps TransferNotFoundError to NOT_FOUND", async () => {
      vi.mocked(completeTransfer).mockRejectedValue(new TransferNotFoundError("not found"));
      const caller = createCaller();
      await expect(caller.account.completeDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });

    it("maps TransferCodeError to UNAUTHORIZED", async () => {
      vi.mocked(completeTransfer).mockRejectedValue(new TransferCodeError("bad code"));
      const caller = createCaller();
      await expect(caller.account.completeDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("maps TransferExpiredError to UNAUTHORIZED", async () => {
      vi.mocked(completeTransfer).mockRejectedValue(new TransferExpiredError("expired"));
      const caller = createCaller();
      await expect(caller.account.completeDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("maps TransferValidationError to BAD_REQUEST", async () => {
      vi.mocked(completeTransfer).mockRejectedValue(new TransferValidationError("invalid"));
      const caller = createCaller();
      await expect(caller.account.completeDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });

    it("maps KeyDerivationUnavailableError to SERVICE_UNAVAILABLE", async () => {
      vi.mocked(completeTransfer).mockRejectedValue(new KeyDerivationUnavailableError("kdf down"));
      const caller = createCaller();
      await expect(caller.account.completeDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "SERVICE_UNAVAILABLE" }),
      );
    });

    it("surfaces unknown errors as INTERNAL_SERVER_ERROR", async () => {
      vi.mocked(completeTransfer).mockRejectedValue(new Error("unexpected"));
      const caller = createCaller();
      await expect(caller.account.completeDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "INTERNAL_SERVER_ERROR" }),
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.completeDeviceTransfer(validInput)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });
});
