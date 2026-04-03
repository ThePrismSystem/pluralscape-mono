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

vi.mock("../../../services/account.service.js", () => ({
  getAccountInfo: vi.fn(),
  changeEmail: vi.fn(),
  changePassword: vi.fn(),
  updateAccountSettings: vi.fn(),
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

const { getAccountInfo, changeEmail, changePassword, updateAccountSettings } =
  await import("../../../services/account.service.js");
const { setAccountPin, removeAccountPin, verifyAccountPin } =
  await import("../../../services/account-pin.service.js");
const { enrollBiometric, verifyBiometric } = await import("../../../services/biometric.service.js");
const { getRecoveryKeyStatus, regenerateRecoveryKeyBackup } =
  await import("../../../services/recovery-key.service.js");
const { queryAuditLog } = await import("../../../services/audit-log-query.service.js");

const { accountRouter } = await import("../../../trpc/routers/account.js");

const createCaller = makeCallerFactory({ account: accountRouter });

const MOCK_TIMESTAMP = 1_700_000_000_000 as UnixMillis;

describe("account router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getInfo ───────────────────────────────────────────────────────

  describe("account.getInfo", () => {
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
      const result = await caller.account.getInfo();
      expect(result).toEqual(mockAccountInfo);
      expect(vi.mocked(getAccountInfo)).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_AUTH.accountId,
      );
    });

    it("throws NOT_FOUND when account does not exist", async () => {
      vi.mocked(getAccountInfo).mockResolvedValue(null);
      const caller = createCaller();
      await expect(caller.account.getInfo()).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.getInfo()).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── changeEmail ───────────────────────────────────────────────────

  describe("account.changeEmail", () => {
    const input = {
      email: "new@example.com",
      currentPassword: "OldPassword1!",
    };

    it("calls changeEmail and returns ok", async () => {
      vi.mocked(changeEmail).mockResolvedValue({ ok: true });
      const caller = createCaller();
      const result = await caller.account.changeEmail(input);
      expect(result).toEqual({ ok: true });
      expect(vi.mocked(changeEmail)).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_AUTH.accountId,
        input,
        noopAuditWriter,
      );
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.account.changeEmail(input)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("rejects invalid email format", async () => {
      const caller = createCaller();
      await expect(caller.account.changeEmail({ ...input, email: "not-an-email" })).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });
  });

  // ── changePassword ────────────────────────────────────────────────

  describe("account.changePassword", () => {
    const input = {
      currentPassword: "OldPassword1!",
      newPassword: "NewPassword1!",
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
      const mockId = "btok_abc123" as BiometricTokenId;
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
    const input = { currentPassword: "MyPassword1!", confirmed: true as const };

    it("calls regenerateRecoveryKeyBackup and returns recovery key", async () => {
      vi.mocked(regenerateRecoveryKeyBackup).mockResolvedValue({ recoveryKey: "AAAA-BBBB-CCCC" });
      const caller = createCaller();
      const result = await caller.account.regenerateRecoveryKey(input);
      expect(result).toEqual({ recoveryKey: "AAAA-BBBB-CCCC" });
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
      () => caller.account.getInfo(),
      "authLight",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(changeEmail).mockResolvedValue({ ok: true });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.account.changeEmail({ email: "new@example.com", currentPassword: "OldPassword1!" }),
      "authHeavy",
    );
  });
});
