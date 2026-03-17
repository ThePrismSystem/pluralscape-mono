import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  hashPin: vi.fn().mockReturnValue("$argon2id$fake$hash"),
  verifyPin: vi.fn().mockReturnValue(true),
}));

vi.mock("@pluralscape/db/pg", () => ({
  systemSettings: { id: "id", systemId: "systemId", pinHash: "pinHash" },
  systems: { id: "id", accountId: "accountId", archived: "archived" },
}));

vi.mock("@pluralscape/validation", () => ({
  SetPinBodySchema: {
    safeParse: vi.fn(),
  },
  VerifyPinBodySchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  eq: vi.fn((col: unknown, val: unknown) => ({ type: "eq", col, val })),
}));

// ── Imports after mocks ──────────────────────────────────────────────

const { SetPinBodySchema, VerifyPinBodySchema } = await import("@pluralscape/validation");
const { hashPin, verifyPin: cryptoVerifyPin } = await import("@pluralscape/crypto");
const { setPin, removePin, verifyPinCode } = await import("../../services/pin.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_test" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
};

const SYSTEM_ID = "sys_test" as SystemId;

// ── Tests ─────────────────────────────────────────────────────────────

describe("pin service", () => {
  const mockAudit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

  afterEach(() => {
    vi.restoreAllMocks();
    (mockAudit as ReturnType<typeof vi.fn>).mockClear();
  });

  describe("setPin", () => {
    beforeEach(() => {
      const schema = vi.mocked(SetPinBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        data: { pin: "1234" },
      });
    });

    it("succeeds and calls audit", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
      chain.returning.mockResolvedValueOnce([{ id: "ss_abc" }]);

      await setPin(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit);

      expect(vi.mocked(hashPin)).toHaveBeenCalledWith("1234", "server");
      expect(mockAudit).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ eventType: "settings.pin-set" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const schema = vi.mocked(SetPinBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: false,
        error: { issues: [] },
      });

      const { db } = mockDb();

      await expect(setPin(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: "Invalid PIN payload",
      });
    });

    it("throws NOT_FOUND when settings not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
      chain.returning.mockResolvedValueOnce([]);

      await expect(setPin(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit)).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "System settings not found",
      });
    });
  });

  describe("removePin", () => {
    it("succeeds and calls audit", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
      chain.returning.mockResolvedValueOnce([{ id: "ss_abc" }]);

      await removePin(db, SYSTEM_ID, AUTH, mockAudit);

      expect(mockAudit).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ eventType: "settings.pin-removed" }),
      );
    });

    it("throws NOT_FOUND when settings not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
      chain.returning.mockResolvedValueOnce([]);

      await expect(removePin(db, SYSTEM_ID, AUTH, mockAudit)).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "System settings not found",
      });
    });
  });

  describe("verifyPinCode", () => {
    beforeEach(() => {
      const schema = vi.mocked(VerifyPinBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        data: { pin: "1234" },
      });
    });

    it("returns { verified: true } on correct PIN", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ pinHash: "$argon2id$fake$hash" }]);
      vi.mocked(cryptoVerifyPin).mockReturnValueOnce(true);

      const result = await verifyPinCode(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit);

      expect(result).toEqual({ verified: true });
      expect(mockAudit).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ eventType: "settings.pin-verified" }),
      );
    });

    it("throws INVALID_PIN when PIN is incorrect", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ pinHash: "$argon2id$fake$hash" }]);
      vi.mocked(cryptoVerifyPin).mockReturnValueOnce(false);

      await expect(
        verifyPinCode(db, SYSTEM_ID, { pin: "9999" }, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "INVALID_PIN",
        message: "PIN is incorrect",
      });
    });

    it("throws INVALID_PIN with anti-timing behavior when no PIN is set", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
      chain.limit.mockResolvedValueOnce([{ pinHash: null }]);
      vi.mocked(cryptoVerifyPin).mockReturnValueOnce(false);

      await expect(
        verifyPinCode(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "INVALID_PIN",
        message: "PIN is incorrect",
      });

      // Anti-timing: verifyPin must be called even when no PIN is stored
      expect(vi.mocked(cryptoVerifyPin)).toHaveBeenCalled();
    });
  });
});
