import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "./helpers/mock-db.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext, SessionAuthContext } from "../lib/auth-context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

// ── Mocks ───────────────────────────────────────────────────────────

const mockVerifyAuthKey = vi.fn<(authKey: Uint8Array, storedHash: Uint8Array) => boolean>();

vi.mock("@pluralscape/crypto", () => ({
  fromHex: vi.fn((hex: string) => new TextEncoder().encode(hex)),
  verifyAuthKey: (authKey: Uint8Array, storedHash: Uint8Array): boolean =>
    mockVerifyAuthKey(authKey, storedHash),
  assertAuthKey: vi.fn(),
  assertAuthKeyHash: vi.fn(),
}));

vi.mock("../lib/rls-context.js", () => ({
  withTenantTransaction: vi.fn(
    <T>(_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<T>): Promise<T> => fn(_db),
  ),
}));

vi.mock("../lib/tenant-context.js", () => ({
  tenantCtx: vi.fn((systemId: string, auth: { accountId: string }) => ({
    systemId,
    accountId: auth.accountId,
  })),
}));

const { purgeSystem } = await import("../services/system-purge.service.js");

// ── Helpers ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_00000000-0000-0000-0000-000000000001");
const ACCOUNT_ID = brandId<AccountId>("acc_00000000-0000-0000-0000-000000000001");

function stubAuth(overrides?: Partial<SessionAuthContext>): AuthContext {
  return {
    authMethod: "session" as const,
    accountId: ACCOUNT_ID,
    systemId: SYSTEM_ID,
    sessionId: brandId<SessionId>("ses_00000000-0000-0000-0000-000000000001"),
    accountType: "system",
    ownedSystemIds: new Set([SYSTEM_ID]),
    auditLogIpTracking: false,
    ...overrides,
  } satisfies SessionAuthContext;
}

function stubAudit(): AuditWriter {
  return vi.fn().mockResolvedValue(undefined);
}

// ── Tests ───────────────────────────────────────────────────────────

describe("purgeSystem", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when system does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      purgeSystem(db, SYSTEM_ID, { authKey: "a".repeat(64) }, stubAuth(), stubAudit()),
    ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND", message: "System not found" }));
  });

  it("throws NOT_ARCHIVED when system is not archived", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID, archived: false }]);

    await expect(
      purgeSystem(db, SYSTEM_ID, { authKey: "a".repeat(64) }, stubAuth(), stubAudit()),
    ).rejects.toThrow(
      expect.objectContaining({
        code: "NOT_ARCHIVED",
        message: "System must be archived before permanent deletion",
      }),
    );
  });

  it("throws VALIDATION_ERROR when auth key is incorrect", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID, archived: true }]);
    chain.limit.mockResolvedValueOnce([{ authKeyHash: new Uint8Array(32) }]);
    mockVerifyAuthKey.mockReturnValue(false);

    await expect(
      purgeSystem(db, SYSTEM_ID, { authKey: "b".repeat(64) }, stubAuth(), stubAudit()),
    ).rejects.toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR", message: "Incorrect password" }),
    );
  });

  it("throws VALIDATION_ERROR when account is not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID, archived: true }]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      purgeSystem(db, SYSTEM_ID, { authKey: "a".repeat(64) }, stubAuth(), stubAudit()),
    ).rejects.toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR", message: "Account not found" }),
    );
  });

  it("deletes system and writes audit on success", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID, archived: true }]);
    chain.limit.mockResolvedValueOnce([{ authKeyHash: new Uint8Array(32) }]);
    mockVerifyAuthKey.mockReturnValue(true);
    chain.returning.mockResolvedValueOnce([{ id: SYSTEM_ID }]);

    const audit = stubAudit();
    await purgeSystem(db, SYSTEM_ID, { authKey: "a".repeat(64) }, stubAuth(), audit);

    expect(audit).toHaveBeenCalledWith(db, expect.objectContaining({ eventType: "system.purged" }));
    expect(chain.delete).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when delete returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID, archived: true }]);
    chain.limit.mockResolvedValueOnce([{ authKeyHash: new Uint8Array(32) }]);
    mockVerifyAuthKey.mockReturnValue(true);
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      purgeSystem(db, SYSTEM_ID, { authKey: "a".repeat(64) }, stubAuth(), stubAudit()),
    ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  });

  it("rejects invalid body (missing authKey)", async () => {
    const { db } = mockDb();

    await expect(
      purgeSystem(db, SYSTEM_ID, { authKey: "" }, stubAuth(), stubAudit()),
    ).rejects.toThrow();
  });
});
