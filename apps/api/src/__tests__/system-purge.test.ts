import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "./helpers/mock-db.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext, SessionAuthContext } from "../lib/auth-context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

// ── Mocks ───────────────────────────────────────────────────────────

const mockVerifyPassword = vi.fn<(hash: string, password: string) => Promise<boolean>>();

vi.mock("../lib/pwhash-offload.js", () => ({
  verifyPasswordOffload: (hash: string, password: string): Promise<boolean> =>
    mockVerifyPassword(hash, password),
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

const SYSTEM_ID = "sys_00000000-0000-0000-0000-000000000001" as SystemId;
const ACCOUNT_ID = "acc_00000000-0000-0000-0000-000000000001" as AccountId;

function stubAuth(overrides?: Partial<SessionAuthContext>): AuthContext {
  return {
    authMethod: "session" as const,
    accountId: ACCOUNT_ID,
    systemId: SYSTEM_ID,
    sessionId: "ses_00000000-0000-0000-0000-000000000001" as SessionId,
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
      purgeSystem(db, SYSTEM_ID, { password: "test123" }, stubAuth(), stubAudit()),
    ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND", message: "System not found" }));
  });

  it("throws NOT_ARCHIVED when system is not archived", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID, archived: false }]);

    await expect(
      purgeSystem(db, SYSTEM_ID, { password: "test123" }, stubAuth(), stubAudit()),
    ).rejects.toThrow(
      expect.objectContaining({
        code: "NOT_ARCHIVED",
        message: "System must be archived before permanent deletion",
      }),
    );
  });

  it("throws VALIDATION_ERROR when password is incorrect", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID, archived: true }]);
    chain.limit.mockResolvedValueOnce([{ passwordHash: "hashed" }]);
    mockVerifyPassword.mockReturnValue(Promise.resolve(false));

    await expect(
      purgeSystem(db, SYSTEM_ID, { password: "wrong" }, stubAuth(), stubAudit()),
    ).rejects.toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR", message: "Incorrect password" }),
    );
  });

  it("throws VALIDATION_ERROR when account is not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID, archived: true }]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      purgeSystem(db, SYSTEM_ID, { password: "test123" }, stubAuth(), stubAudit()),
    ).rejects.toThrow(
      expect.objectContaining({ code: "VALIDATION_ERROR", message: "Account not found" }),
    );
  });

  it("deletes system and writes audit on success", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID, archived: true }]);
    chain.limit.mockResolvedValueOnce([{ passwordHash: "hashed" }]);
    mockVerifyPassword.mockReturnValue(Promise.resolve(true));
    chain.returning.mockResolvedValueOnce([{ id: SYSTEM_ID }]);

    const audit = stubAudit();
    await purgeSystem(db, SYSTEM_ID, { password: "correct" }, stubAuth(), audit);

    expect(audit).toHaveBeenCalledWith(db, expect.objectContaining({ eventType: "system.purged" }));
    expect(chain.delete).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when delete returns no rows", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID, archived: true }]);
    chain.limit.mockResolvedValueOnce([{ passwordHash: "hashed" }]);
    mockVerifyPassword.mockReturnValue(Promise.resolve(true));
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      purgeSystem(db, SYSTEM_ID, { password: "correct" }, stubAuth(), stubAudit()),
    ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  });

  it("rejects invalid body (missing password)", async () => {
    const { db } = mockDb();

    await expect(purgeSystem(db, SYSTEM_ID, {}, stubAuth(), stubAudit())).rejects.toThrow();
  });
});
