import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AccountId, SystemId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/db/pg", () => ({
  systemSettings: {
    id: "id",
    systemId: "system_id",
    pinHash: "pin_hash",
  },
  systems: {
    id: "id",
    accountId: "account_id",
  },
}));

vi.mock("../../lib/kdf-offload.js", () => ({
  hashPinOffload: vi.fn().mockResolvedValue("$argon2id$hashed-pin"),
  verifyPinOffload: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../lib/rls-context.js", () => ({
  withAccountTransaction: vi.fn(
    (_db: unknown, _accountId: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockTx),
  ),
  withAccountRead: vi.fn(
    (_db: unknown, _accountId: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockTx),
  ),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  };
});

// ── Mock tx ──────────────────────────────────────────────────────────

const mockTx = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  for: vi.fn(),
};

function wireChain(): void {
  mockTx.select.mockReturnValue(mockTx);
  mockTx.from.mockReturnValue(mockTx);
  mockTx.where.mockReturnValue(mockTx);
  // limit is terminal by default; tests needing .limit().for() use
  // mockReturnValueOnce(mockTx) to keep the chain open.
  mockTx.limit.mockResolvedValue([]);
  mockTx.insert.mockReturnValue(mockTx);
  mockTx.values.mockReturnValue(mockTx);
  mockTx.returning.mockResolvedValue([]);
  mockTx.update.mockReturnValue(mockTx);
  mockTx.set.mockReturnValue(mockTx);
  mockTx.for.mockResolvedValue([]);
}

wireChain();

// ── Import under test ────────────────────────────────────────────────

const { hashPinOffload, verifyPinOffload } = await import("../../lib/kdf-offload.js");
const { setAccountPin, removeAccountPin, verifyAccountPin } =
  await import("../../services/account-pin.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const ACCOUNT_ID = brandId<AccountId>("acct_test-account");
const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const mockAudit = vi.fn().mockResolvedValue(undefined);
const VALID_PIN = "1234";

// ── Tests ────────────────────────────────────────────────────────────

describe("setAccountPin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
    wireChain();
  });

  it("sets PIN for account with valid payload", async () => {
    // resolveSystemId → system found
    mockTx.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
    // update system_settings → returns row
    mockTx.returning.mockResolvedValueOnce([{ id: "ss_1" }]);

    await setAccountPin({} as never, ACCOUNT_ID, { pin: VALID_PIN }, mockAudit);

    expect(vi.mocked(hashPinOffload)).toHaveBeenCalledWith(VALID_PIN);
    expect(mockAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ eventType: "settings.pin-set" }),
    );
  });

  it("throws NOT_FOUND when no system exists for account", async () => {
    // resolveSystemId → empty
    mockTx.limit.mockResolvedValueOnce([]);

    await expect(
      setAccountPin({} as never, ACCOUNT_ID, { pin: VALID_PIN }, mockAudit),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "No system found for account",
      }),
    );
  });

  it("throws NOT_FOUND when system settings not found (update returns empty)", async () => {
    // resolveSystemId → system found
    mockTx.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
    // update returns empty
    mockTx.returning.mockResolvedValueOnce([]);

    await expect(
      setAccountPin({} as never, ACCOUNT_ID, { pin: VALID_PIN }, mockAudit),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "System settings not found",
      }),
    );
  });
});

describe("removeAccountPin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
    wireChain();
  });

  it("removes PIN successfully when correct PIN is provided", async () => {
    // resolveSystemId → system found (limit is terminal)
    mockTx.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
    // select pinHash: .limit(1).for("update") — limit chains, for resolves
    mockTx.limit.mockReturnValueOnce(mockTx);
    mockTx.for.mockResolvedValueOnce([{ pinHash: "$argon2id$existing-hash" }]);
    vi.mocked(verifyPinOffload).mockResolvedValueOnce(true);

    await removeAccountPin({} as never, ACCOUNT_ID, { pin: VALID_PIN }, mockAudit);

    expect(vi.mocked(verifyPinOffload)).toHaveBeenCalledWith("$argon2id$existing-hash", VALID_PIN);
    expect(mockAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ eventType: "settings.pin-removed" }),
    );
  });

  it("throws NOT_FOUND when no system found for account", async () => {
    mockTx.limit.mockResolvedValueOnce([]);

    await expect(
      removeAccountPin({} as never, ACCOUNT_ID, { pin: VALID_PIN }, mockAudit),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "No system found for account",
      }),
    );
  });

  it("throws NOT_FOUND when system settings row not found", async () => {
    // resolveSystemId → system found (limit is terminal)
    mockTx.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
    // select pinHash: .limit(1).for("update") — limit chains, for resolves empty
    mockTx.limit.mockReturnValueOnce(mockTx);
    mockTx.for.mockResolvedValueOnce([]);

    await expect(
      removeAccountPin({} as never, ACCOUNT_ID, { pin: VALID_PIN }, mockAudit),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "System settings not found",
      }),
    );
  });

  it("throws NOT_FOUND when no PIN is currently set", async () => {
    // resolveSystemId → system found (limit is terminal)
    mockTx.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
    // select pinHash: .limit(1).for("update") — row exists but pinHash is null
    mockTx.limit.mockReturnValueOnce(mockTx);
    mockTx.for.mockResolvedValueOnce([{ pinHash: null }]);

    await expect(
      removeAccountPin({} as never, ACCOUNT_ID, { pin: VALID_PIN }, mockAudit),
    ).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND", message: "No PIN is set" }),
    );
  });

  it("throws INVALID_PIN when PIN verification fails", async () => {
    // resolveSystemId → system found (limit is terminal)
    mockTx.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
    // select pinHash: .limit(1).for("update") — row with hash
    mockTx.limit.mockReturnValueOnce(mockTx);
    mockTx.for.mockResolvedValueOnce([{ pinHash: "$argon2id$existing-hash" }]);
    vi.mocked(verifyPinOffload).mockResolvedValueOnce(false);

    await expect(
      removeAccountPin({} as never, ACCOUNT_ID, { pin: "9999" }, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 401, code: "INVALID_PIN" }));
  });
});

describe("verifyAccountPin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
    wireChain();
  });

  it("returns { verified: true } when PIN is correct", async () => {
    // resolveSystemId → system found
    mockTx.limit
      .mockResolvedValueOnce([{ id: SYSTEM_ID }])
      // select pinHash → row with hash
      .mockResolvedValueOnce([{ pinHash: "$argon2id$real-hash" }]);
    vi.mocked(verifyPinOffload).mockResolvedValueOnce(true);

    const result = await verifyAccountPin({} as never, ACCOUNT_ID, { pin: VALID_PIN }, mockAudit);

    expect(result).toEqual({ verified: true });
    expect(vi.mocked(verifyPinOffload)).toHaveBeenCalledWith("$argon2id$real-hash", VALID_PIN);
    expect(mockAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ eventType: "settings.pin-verified" }),
    );
  });

  it("throws NOT_FOUND when no system found for account", async () => {
    mockTx.limit.mockResolvedValueOnce([]);

    await expect(
      verifyAccountPin({} as never, ACCOUNT_ID, { pin: VALID_PIN }, mockAudit),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "No system found for account",
      }),
    );
  });

  it("uses dummy hash and throws NOT_FOUND when system settings row is missing (anti-timing)", async () => {
    // resolveSystemId → system found
    mockTx.limit
      .mockResolvedValueOnce([{ id: SYSTEM_ID }])
      // select pinHash → empty (no row)
      .mockResolvedValueOnce([]);
    // verifyPinOffload is called with dummy hash for timing equalization
    vi.mocked(verifyPinOffload).mockResolvedValueOnce(false);

    await expect(
      verifyAccountPin({} as never, ACCOUNT_ID, { pin: VALID_PIN }, mockAudit),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "System settings not found",
      }),
    );

    // Verify anti-timing: verifyPinOffload was still called with the dummy hash
    expect(vi.mocked(verifyPinOffload)).toHaveBeenCalledWith(
      expect.stringContaining("$argon2id$"),
      VALID_PIN,
    );
  });

  it("uses dummy hash and throws NOT_FOUND when pinHash is null (anti-timing)", async () => {
    // resolveSystemId → system found
    mockTx.limit
      .mockResolvedValueOnce([{ id: SYSTEM_ID }])
      // select pinHash → row exists but pinHash is null
      .mockResolvedValueOnce([{ pinHash: null }]);
    // verifyPinOffload called with dummy hash
    vi.mocked(verifyPinOffload).mockResolvedValueOnce(false);

    await expect(
      verifyAccountPin({} as never, ACCOUNT_ID, { pin: VALID_PIN }, mockAudit),
    ).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND", message: "No PIN is set" }),
    );

    // Anti-timing: verify was still called
    expect(vi.mocked(verifyPinOffload)).toHaveBeenCalled();
  });

  it("throws INVALID_PIN when PIN verification fails", async () => {
    // resolveSystemId → system found
    mockTx.limit
      .mockResolvedValueOnce([{ id: SYSTEM_ID }])
      // select pinHash → row with hash
      .mockResolvedValueOnce([{ pinHash: "$argon2id$real-hash" }]);
    vi.mocked(verifyPinOffload).mockResolvedValueOnce(false);

    await expect(
      verifyAccountPin({} as never, ACCOUNT_ID, { pin: "9999" }, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 401, code: "INVALID_PIN" }));
  });
});
