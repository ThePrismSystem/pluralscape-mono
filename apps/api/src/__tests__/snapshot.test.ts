import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "./helpers/mock-db.js";

import type { AuditWriter } from "../lib/audit-writer.js";
import type { AuthContext } from "../lib/auth-context.js";
import type {
  AccountId,
  EncryptedBlob,
  SessionId,
  SystemId,
  SystemSnapshotId,
} from "@pluralscape/types";

// ── Mocks ───────────────────────────────────────────────────────────

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

const mockParseAndValidateBlob = vi.fn();
vi.mock("../lib/encrypted-blob.js", () => ({
  parseAndValidateBlob: (
    params: unknown,
    schema: unknown,
    maxBytes: number,
  ): { parsed: Record<string, unknown>; blob: EncryptedBlob } =>
    mockParseAndValidateBlob(params, schema, maxBytes) as {
      parsed: Record<string, unknown>;
      blob: EncryptedBlob;
    },
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

const { createSnapshot, getSnapshot, listSnapshots, deleteSnapshot } =
  await import("../services/snapshot.service.js");

// ── Helpers ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_00000000-0000-0000-0000-000000000001" as SystemId;
const SNAPSHOT_ID = "snap_00000000-0000-0000-0000-000000000001" as SystemSnapshotId;
const ACCOUNT_ID = "acc_00000000-0000-0000-0000-000000000001" as AccountId;

/** Stub T1 blob satisfying the EncryptedBlob discriminated union. */
const FAKE_BLOB: EncryptedBlob = {
  tier: 1,
  ciphertext: new Uint8Array([1, 2, 3]),
  nonce: new Uint8Array(24),
  algorithm: "xchacha20-poly1305",
  keyVersion: null,
  bucketId: null,
};

function stubAuth(overrides?: Partial<AuthContext>): AuthContext {
  return {
    accountId: ACCOUNT_ID,
    systemId: SYSTEM_ID,
    sessionId: "ses_00000000-0000-0000-0000-000000000001" as SessionId,
    accountType: "system",
    ownedSystemIds: new Set([SYSTEM_ID]),
    auditLogIpTracking: false,
    ...overrides,
  };
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

  it("throws NOT_FOUND when system does not exist", async () => {
    const { db, chain } = mockDb();
    mockParseAndValidateBlob.mockReturnValue({
      parsed: { snapshotTrigger: "manual", encryptedData: "abc" },
      blob: FAKE_BLOB,
    });
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      createSnapshot(
        db,
        SYSTEM_ID,
        { snapshotTrigger: "manual", encryptedData: "abc" },
        stubAuth(),
        stubAudit(),
      ),
    ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  });

  it("creates snapshot and writes audit on success", async () => {
    const { db, chain } = mockDb();
    mockParseAndValidateBlob.mockReturnValue({
      parsed: { snapshotTrigger: "manual", encryptedData: "abc" },
      blob: FAKE_BLOB,
    });
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
    chain.returning.mockResolvedValueOnce([snapshotRow()]);

    const audit = stubAudit();
    const result = await createSnapshot(
      db,
      SYSTEM_ID,
      { snapshotTrigger: "manual", encryptedData: "abc" },
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
    mockParseAndValidateBlob.mockReturnValue({
      parsed: { snapshotTrigger: "manual", encryptedData: "abc" },
      blob: FAKE_BLOB,
    });
    chain.limit.mockResolvedValueOnce([{ id: SYSTEM_ID }]);
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      createSnapshot(
        db,
        SYSTEM_ID,
        { snapshotTrigger: "manual", encryptedData: "abc" },
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

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it("returns empty result when no snapshots exist", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const result = await listSnapshots(db, SYSTEM_ID, stubAuth());

    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
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
