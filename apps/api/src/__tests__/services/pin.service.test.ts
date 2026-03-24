import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../lib/pwhash-offload.js", () => ({
  hashPinOffload: vi.fn().mockResolvedValue("$argon2id$fake$hash"),
  verifyPinOffload: vi.fn().mockResolvedValue(true),
}));

vi.mock("@pluralscape/db/pg", () => ({
  systemSettings: { id: "id", systemId: "systemId", pinHash: "pinHash" },
  systems: { id: "id", accountId: "accountId", archived: "archived" },
}));

vi.mock("@pluralscape/validation", () => ({
  SetPinBodySchema: {
    safeParse: vi.fn(),
  },
  RemovePinBodySchema: {
    safeParse: vi.fn(),
  },
  VerifyPinBodySchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ type: "eq", col, val })),
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { SetPinBodySchema, RemovePinBodySchema, VerifyPinBodySchema } =
  await import("@pluralscape/validation");
const { hashPinOffload, verifyPinOffload } = await import("../../lib/pwhash-offload.js");
const { setPin, removePin, verifyPinCode } = await import("../../services/pin.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_test" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set(["sys_test" as SystemId]),
  auditLogIpTracking: false,
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

    it("throws 404 for system ownership failure", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));
      const { db } = mockDb();

      await expect(setPin(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("succeeds and calls audit", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ id: "ss_abc" }]);

      await setPin(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit);

      expect(vi.mocked(hashPinOffload)).toHaveBeenCalledWith("1234", "server");
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
      chain.returning.mockResolvedValueOnce([]);

      await expect(setPin(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit)).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "System settings not found",
      });
    });
  });

  describe("removePin", () => {
    beforeEach(() => {
      const schema = vi.mocked(RemovePinBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValue({
        success: true,
        data: { pin: "1234" },
      });
    });

    it("succeeds when current PIN is correct", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ pinHash: "$argon2id$fake$hash" }]);
      vi.mocked(verifyPinOffload).mockResolvedValueOnce(true);

      await removePin(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit);

      expect(mockAudit).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ eventType: "settings.pin-removed" }),
      );
    });

    it("throws NOT_FOUND when settings not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        removePin(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "System settings not found",
      });
    });

    it("throws NOT_FOUND when no PIN is set", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ pinHash: null }]);

      await expect(
        removePin(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "No PIN is set",
      });
    });

    it("throws INVALID_PIN when current PIN is wrong", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ pinHash: "$argon2id$fake$hash" }]);
      vi.mocked(verifyPinOffload).mockResolvedValueOnce(false);

      await expect(
        removePin(db, SYSTEM_ID, { pin: "9999" }, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "INVALID_PIN",
        message: "PIN is incorrect",
      });
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const schema = vi.mocked(RemovePinBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: false,
        error: { issues: [] },
      });

      const { db } = mockDb();

      await expect(removePin(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: "Invalid PIN payload",
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
      chain.limit.mockResolvedValueOnce([{ pinHash: "$argon2id$fake$hash" }]);
      vi.mocked(verifyPinOffload).mockResolvedValueOnce(true);

      const result = await verifyPinCode(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit);

      expect(result).toEqual({ verified: true });
      expect(mockAudit).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ eventType: "settings.pin-verified" }),
      );
    });

    it("throws INVALID_PIN when PIN is incorrect", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ pinHash: "$argon2id$fake$hash" }]);
      vi.mocked(verifyPinOffload).mockResolvedValueOnce(false);

      await expect(
        verifyPinCode(db, SYSTEM_ID, { pin: "9999" }, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "INVALID_PIN",
        message: "PIN is incorrect",
      });
    });

    it("throws NOT_FOUND when settings don't exist", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);
      vi.mocked(verifyPinOffload).mockResolvedValueOnce(false);

      await expect(
        verifyPinCode(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "System settings not found",
      });

      // Anti-timing: verifyPinOffload must be called even when no row
      expect(vi.mocked(verifyPinOffload)).toHaveBeenCalled();
    });

    it("throws NOT_FOUND when no PIN is set (with anti-timing)", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ pinHash: null }]);
      vi.mocked(verifyPinOffload).mockResolvedValueOnce(false);

      await expect(
        verifyPinCode(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "No PIN is set",
      });

      // Anti-timing: verifyPinOffload must be called even when no PIN is stored
      expect(vi.mocked(verifyPinOffload)).toHaveBeenCalled();
    });
  });
});
