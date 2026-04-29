import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../service.constants.js";

import { mockDb } from "./helpers/mock-db.js";
import { mockOwnershipFailure } from "./helpers/mock-ownership.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext, SessionAuthContext } from "../lib/auth-context.js";
import type {
  EncryptedBase64,
  AccountId,
  EncryptedBlob,
  SessionId,
  SystemId,
  SystemSnapshotId,
} from "@pluralscape/types";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../lib/rls-context.js", () => ({
  withTenantTransaction: vi.fn(
    <T>(_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<T>): Promise<T> => fn(_db),
  ),
  withTenantRead: vi.fn(
    <T>(_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<T>): Promise<T> => fn(_db),
  ),
}));

vi.mock("../lib/tenant-context.js", () => ({
  tenantCtx: vi.fn((systemId: string, auth: { accountId: string }) => ({
    systemId,
    accountId: auth.accountId,
  })),
}));

const mockValidateEncryptedBlob = vi.fn();
vi.mock("../lib/encrypted-blob.js", () => ({
  validateEncryptedBlob: (base64Data: string, maxBytes: number): EncryptedBlob =>
    mockValidateEncryptedBlob(base64Data, maxBytes) as EncryptedBlob,
  encryptedBlobToBase64: (): string => "base64encodedblob",
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn((): string => "snap_00000000-0000-0000-0000-000000000099"),
    now: vi.fn((): number => 1_700_000_000),
  };
});

const { assertSystemOwnership } = await import("../lib/system-ownership.js");
const { createSnapshot, getSnapshot, listSnapshots, deleteSnapshot } =
  await import("../services/snapshot.service.js");

// ── Helpers ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_00000000-0000-0000-0000-000000000001");
const SNAPSHOT_ID = brandId<SystemSnapshotId>("snap_00000000-0000-0000-0000-000000000001");
const ACCOUNT_ID = brandId<AccountId>("acc_00000000-0000-0000-0000-000000000001");

/** Stub T1 blob satisfying the EncryptedBlob discriminated union. */
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

function snapshotRow(overrides?: Record<string, unknown>) {
  return {
    id: SNAPSHOT_ID,
    systemId: SYSTEM_ID,
    snapshotTrigger: "manual",
    encryptedData: FAKE_BLOB,
    createdAt: 1_700_000_000,
    ...overrides,
  };
}

// ── createSnapshot ──────────────────────────────────────────────────

describe("createSnapshot", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when system ownership check fails", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(
      createSnapshot(
        db,
        SYSTEM_ID,
        { snapshotTrigger: "manual", encryptedData: "abc" as EncryptedBase64 },
        stubAuth(),
        stubAudit(),
      ),
    ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  });

  it("creates snapshot and writes audit on success", async () => {
    const { db, chain } = mockDb();
    mockValidateEncryptedBlob.mockReturnValue(FAKE_BLOB);
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
    chain.returning.mockResolvedValueOnce([snapshotRow()]);

    const audit = stubAudit();
    const result = await createSnapshot(
      db,
      SYSTEM_ID,
      { snapshotTrigger: "manual", encryptedData: "abc" as EncryptedBase64 },
      stubAuth(),
      audit,
    );

    expect(result.id).toBe(SNAPSHOT_ID);
    expect(result.snapshotTrigger).toBe("manual");
    expect(audit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ eventType: "snapshot.created" }),
    );
  });

  it("throws when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    mockValidateEncryptedBlob.mockReturnValue(FAKE_BLOB);
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createSnapshot(
        db,
        SYSTEM_ID,
        { snapshotTrigger: "manual", encryptedData: "abc" as EncryptedBase64 },
        stubAuth(),
        stubAudit(),
      ),
    ).rejects.toThrow("Failed to create snapshot");
  });
});

// ── getSnapshot ─────────────────────────────────────────────────────

describe("getSnapshot", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns snapshot when found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([snapshotRow()]);

    const result = await getSnapshot(db, SYSTEM_ID, SNAPSHOT_ID, stubAuth());

    expect(result.id).toBe(SNAPSHOT_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
  });

  it("throws NOT_FOUND when snapshot does not exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(getSnapshot(db, SYSTEM_ID, SNAPSHOT_ID, stubAuth())).rejects.toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
  });
});

// ── listSnapshots ───────────────────────────────────────────────────

describe("listSnapshots", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated result", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([snapshotRow()]);

    const result = await listSnapshots(db, SYSTEM_ID, stubAuth());

    expect(result.data).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it("returns empty result when no snapshots exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const result = await listSnapshots(db, SYSTEM_ID, stubAuth());

    expect(result.data).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it("sets hasMore and nextCursor when results exceed limit", async () => {
    const limit = 2;
    // Service fetches limit+1 rows; extra row signals more pages
    const rows = Array.from({ length: limit + 1 }, (_, i) =>
      snapshotRow({ id: `snap_00000000-0000-0000-0000-00000000000${String(i + 1)}` }),
    );
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listSnapshots(db, SYSTEM_ID, stubAuth(), undefined, limit);

    expect(result.data).toHaveLength(limit);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeTypeOf("string");
    expect(result.nextCursor).not.toBeNull();
  });

  it("respects cursor parameter for pagination", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      snapshotRow({ id: "snap_00000000-0000-0000-0000-000000000005" }),
    ]);

    const fakeCursor = "some-decoded-cursor-id";
    const result = await listSnapshots(db, SYSTEM_ID, stubAuth(), fakeCursor, 10);

    expect(result.data).toHaveLength(1);
    expect(result.hasMore).toBe(false);
    // The where clause should have been called (system filter + cursor filter)
    expect(chain.where).toHaveBeenCalled();
  });

  it("caps limit at MAX_PAGE_LIMIT", async () => {
    const overLimit = MAX_PAGE_LIMIT + 50;
    // Service clamps to MAX_PAGE_LIMIT, then fetches MAX_PAGE_LIMIT+1 rows
    const rows = Array.from({ length: MAX_PAGE_LIMIT + 1 }, (_, i) =>
      snapshotRow({ id: `snap_00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}` }),
    );
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listSnapshots(db, SYSTEM_ID, stubAuth(), undefined, overLimit);

    // Items capped to MAX_PAGE_LIMIT despite requesting more
    expect(result.data).toHaveLength(MAX_PAGE_LIMIT);
    expect(result.hasMore).toBe(true);
    // chain.limit receives effectiveLimit + 1, which is MAX_PAGE_LIMIT + 1
    expect(chain.limit).toHaveBeenCalledWith(MAX_PAGE_LIMIT + 1);
  });

  it("uses DEFAULT_PAGE_LIMIT when no limit provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listSnapshots(db, SYSTEM_ID, stubAuth());

    // chain.limit receives DEFAULT_PAGE_LIMIT + 1 (the +1 for hasMore detection)
    expect(chain.limit).toHaveBeenCalledWith(DEFAULT_PAGE_LIMIT + 1);
  });
});

// ── deleteSnapshot ──────────────────────────────────────────────────

describe("deleteSnapshot", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("deletes snapshot and writes audit", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: SNAPSHOT_ID }]);

    const audit = stubAudit();
    await deleteSnapshot(db, SYSTEM_ID, SNAPSHOT_ID, stubAuth(), audit);

    expect(chain.delete).toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ eventType: "snapshot.deleted" }),
    );
  });

  it("throws NOT_FOUND when snapshot does not exist", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      deleteSnapshot(db, SYSTEM_ID, SNAPSHOT_ID, stubAuth(), stubAudit()),
    ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  });
});
