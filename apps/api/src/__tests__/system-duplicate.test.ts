import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "./helpers/mock-db.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext, SessionAuthContext } from "../lib/auth-context.js";
import type {
  AccountId,
  EncryptedBlob,
  SessionId,
  SystemId,
  SystemSnapshotId,
} from "@pluralscape/types";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("../lib/rls-context.js", () => ({
  withAccountTransaction: vi.fn(
    <T>(_db: unknown, _accountId: unknown, fn: (tx: unknown) => Promise<T>): Promise<T> => fn(_db),
  ),
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn((): string => "sys_00000000-0000-0000-0000-000000000099"),
    now: vi.fn((): number => 1_700_000_000),
  };
});

const { duplicateSystem } = await import("../services/system-duplicate.service.js");

// ── Helpers ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_00000000-0000-0000-0000-000000000001");
const ACCOUNT_ID = brandId<AccountId>("acc_00000000-0000-0000-0000-000000000001");
const SNAPSHOT_ID = brandId<SystemSnapshotId>("snap_00000000-0000-0000-0000-000000000001");
const FAKE_BLOB: EncryptedBlob = {
  tier: 1,
  ciphertext: new Uint8Array([1, 2, 3]),
  nonce: new Uint8Array(24),
  algorithm: "xchacha20-poly1305",
  keyVersion: null,
  bucketId: null,
};

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

describe("duplicateSystem", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("throws FORBIDDEN for non-system account types", async () => {
    const { db } = mockDb();

    await expect(
      duplicateSystem(
        db,
        SYSTEM_ID,
        { snapshotId: SNAPSHOT_ID },
        stubAuth({ accountType: "viewer" }),
        stubAudit(),
      ),
    ).rejects.toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("throws NOT_FOUND when source system does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      duplicateSystem(db, SYSTEM_ID, { snapshotId: SNAPSHOT_ID }, stubAuth(), stubAudit()),
    ).rejects.toThrow(
      expect.objectContaining({ code: "NOT_FOUND", message: "Source system not found" }),
    );
  });

  it("throws NOT_FOUND when snapshot does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      duplicateSystem(db, SYSTEM_ID, { snapshotId: SNAPSHOT_ID }, stubAuth(), stubAudit()),
    ).rejects.toThrow(
      expect.objectContaining({ code: "NOT_FOUND", message: "Snapshot not found" }),
    );
  });

  it("creates new system from snapshot and writes audit", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
    chain.limit.mockResolvedValueOnce([{ id: SNAPSHOT_ID, encryptedData: FAKE_BLOB }]);

    const audit = stubAudit();
    const result = await duplicateSystem(
      db,
      SYSTEM_ID,
      { snapshotId: SNAPSHOT_ID },
      stubAuth(),
      audit,
    );

    expect(result.id).toBe("sys_00000000-0000-0000-0000-000000000099");
    expect(result.sourceSnapshotId).toBe(SNAPSHOT_ID);
    expect(chain.insert).toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ eventType: "system.duplicated" }),
    );
  });

  it("rejects invalid body (missing snapshotId)", async () => {
    const { db } = mockDb();

    await expect(
      duplicateSystem(db, SYSTEM_ID, { snapshotId: SNAPSHOT_ID }, stubAuth(), stubAudit()),
    ).rejects.toThrow();
  });
});
