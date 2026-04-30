import { brandId } from "@pluralscape/types";
import { describe, it, expect, vi, afterEach } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("../../lib/kdf-offload.js", () => ({
  hashPinOffload: vi.fn().mockResolvedValue("$argon2id$fake$hash"),
  verifyPinOffload: vi.fn().mockResolvedValue(true),
}));

vi.mock("@pluralscape/db/pg", () => ({
  systemSettings: { id: "id", systemId: "systemId", pinHash: "pinHash" },
  systems: { id: "id", accountId: "accountId", archived: "archived" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ type: "eq", col, val })),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values, _tag: "sql" }),
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { hashPinOffload, verifyPinOffload } = await import("../../lib/kdf-offload.js");
const { setPin, removePin, verifyPinCode } = await import("../../services/pin.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const AUTH = makeTestAuth();

const SYSTEM_ID = brandId<SystemId>("sys_test");

// ── Tests ─────────────────────────────────────────────────────────────

describe("pin service", () => {
  const mockAudit: AuditWriter = vi.fn().mockResolvedValue(undefined) as AuditWriter;

  afterEach(() => {
    vi.restoreAllMocks();
    (mockAudit as ReturnType<typeof vi.fn>).mockClear();
  });

  describe("setPin", () => {
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

      expect(vi.mocked(hashPinOffload)).toHaveBeenCalledWith("1234");
      expect(mockAudit).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ eventType: "settings.pin-set" }),
      );
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
    it("succeeds when current PIN is correct", async () => {
      const { db, chain } = mockDb();
      // removePin uses .limit(1).for("update") — limit must return chain, for returns data
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([{ pinHash: "$argon2id$fake$hash" }]);
      vi.mocked(verifyPinOffload).mockResolvedValueOnce(true);

      await removePin(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit);

      expect(mockAudit).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ eventType: "settings.pin-removed" }),
      );
    });

    it("throws NOT_FOUND when settings not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([]);

      await expect(
        removePin(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "System settings not found",
      });
    });

    it("throws NOT_FOUND when no PIN is set", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([{ pinHash: null }]);

      await expect(
        removePin(db, SYSTEM_ID, { pin: "1234" }, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "No PIN is set",
      });
    });

    it("throws INVALID_PIN when current PIN is wrong", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([{ pinHash: "$argon2id$fake$hash" }]);
      vi.mocked(verifyPinOffload).mockResolvedValueOnce(false);

      await expect(
        removePin(db, SYSTEM_ID, { pin: "9999" }, AUTH, mockAudit),
      ).rejects.toMatchObject({
        code: "INVALID_PIN",
        message: "PIN is incorrect",
      });
    });
  });

  describe("verifyPinCode", () => {
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
