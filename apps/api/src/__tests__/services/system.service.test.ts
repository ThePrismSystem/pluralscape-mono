import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthContext } from "../../lib/auth-context.js";
import type { RequestMeta } from "../../services/auth.service.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// ── Mock helpers ─────────────────────────────────────────────────────

function asDb(mock: unknown): PostgresJsDatabase {
  return mock as PostgresJsDatabase;
}

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
}

function mockDb(overrides?: Partial<MockChain>): {
  db: PostgresJsDatabase;
  chain: MockChain;
} {
  const chain: MockChain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    ...overrides,
  };

  chain.select.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockResolvedValue([]);
  chain.insert.mockReturnValue(chain);
  chain.values.mockReturnValue(chain);
  chain.returning.mockResolvedValue([]);
  chain.update.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.transaction = vi
    .fn()
    .mockImplementation((fn: (tx: MockChain) => Promise<unknown>) => fn(chain));

  return { db: asDb(chain), chain };
}

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  serializeEncryptedBlob: vi.fn(() => new Uint8Array([1, 2, 3])),
  deserializeEncryptedBlob: vi.fn((data: Uint8Array) => ({
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
    nonce: new Uint8Array(24),
    ciphertext: new Uint8Array(data.slice(32)),
  })),
  InvalidInputError: class InvalidInputError extends Error {
    override readonly name = "InvalidInputError" as const;
  },
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const { InvalidInputError } = await import("@pluralscape/crypto");
const { getSystemProfile, updateSystemProfile, archiveSystem, createSystem } =
  await import("../../services/system.service.js");
const { writeAuditLog } = await import("../../lib/audit-log.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
};

const REQUEST_META: RequestMeta = {
  ipAddress: "127.0.0.1",
  userAgent: "test-agent",
};

function makeSystemRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "sys_test-system",
    accountId: AUTH.accountId,
    encryptedData: null,
    version: 1,
    createdAt: 1000,
    updatedAt: 1000,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("getSystemProfile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns system profile for owned system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeSystemRow()]);

    const result = await getSystemProfile(db, SYSTEM_ID, AUTH);

    expect(result.id).toBe("sys_test-system");
    expect(result.encryptedData).toBeNull();
    expect(result.version).toBe(1);
  });

  it("returns base64 encryptedData when present", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([
      makeSystemRow({ encryptedData: new Uint8Array([1, 2, 3, 4]) }),
    ]);

    const result = await getSystemProfile(db, SYSTEM_ID, AUTH);

    expect(result.encryptedData).toBeTypeOf("string");
    expect(result.encryptedData).not.toBeNull();
  });

  it("throws 404 when system not found", async () => {
    const { db } = mockDb();

    await expect(getSystemProfile(db, "sys_nonexistent" as SystemId, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws 404 for system owned by different account", async () => {
    const { db } = mockDb();

    await expect(getSystemProfile(db, "sys_other" as SystemId, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("does not return archived systems", async () => {
    const { db } = mockDb();
    // WHERE includes archived = false, so archived systems return empty

    await expect(getSystemProfile(db, SYSTEM_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("updateSystemProfile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Valid base64-encoded blob data (at least 32 bytes to have header + nonce room)
  const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

  it("updates system profile successfully with version increment", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeSystemRow({ version: 2, encryptedData: new Uint8Array([1, 2, 3]) });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateSystemProfile(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      REQUEST_META,
    );

    expect(result.id).toBe("sys_test-system");
    expect(result.version).toBe(2);
    expect(chain.transaction).toHaveBeenCalled();
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "system.profile-updated" }),
    );
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    // Follow-up SELECT finds the system (= conflict, not 404)
    chain.limit.mockResolvedValueOnce([{ id: "sys_test-system" }]);

    await expect(
      updateSystemProfile(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        REQUEST_META,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when system not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateSystemProfile(
        db,
        "sys_nonexistent" as SystemId,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        REQUEST_META,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for malformed blob", async () => {
    const { db } = mockDb();
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new InvalidInputError("Invalid blob");
    });

    await expect(
      updateSystemProfile(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        REQUEST_META,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for oversized blob", async () => {
    const { db } = mockDb();
    const oversized = Buffer.from(new Uint8Array(70_000)).toString("base64");

    await expect(
      updateSystemProfile(
        db,
        SYSTEM_ID,
        { encryptedData: oversized, version: 1 },
        AUTH,
        REQUEST_META,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "BLOB_TOO_LARGE" }));
  });

  it("throws 400 for invalid body (missing version)", async () => {
    const { db } = mockDb();

    await expect(
      updateSystemProfile(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, REQUEST_META),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("archiveSystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("archives an empty system when multiple systems exist", async () => {
    const { db, chain } = mockDb();
    // 1. ownership check: select().from().where().limit() → found
    chain.limit.mockResolvedValueOnce([{ id: "sys_test-system" }]);
    // 2. system count: select().from().where() → resolves directly (no .limit())
    // 3. member count: select().from().where() → resolves directly
    // 4. archive: update().set().where().returning() → returns archived row
    chain.where
      .mockReturnValueOnce(chain) // ownership query → chains to .limit()
      .mockResolvedValueOnce([{ count: 2 }]) // system count
      .mockResolvedValueOnce([{ count: 0 }]); // member count
    chain.returning.mockResolvedValueOnce([{ id: "sys_test-system" }]);

    await archiveSystem(db, SYSTEM_ID, AUTH, REQUEST_META);

    expect(chain.transaction).toHaveBeenCalled();
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "system.deleted" }),
    );
  });

  it("throws 404 when system not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveSystem(db, "sys_nonexistent" as SystemId, AUTH, REQUEST_META),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 when it is the last system", async () => {
    const { db, chain } = mockDb();
    // ownership check finds the system
    chain.limit.mockResolvedValueOnce([{ id: "sys_test-system" }]);
    // system count = 1 (last system), member count not reached
    chain.where
      .mockReturnValueOnce(chain) // ownership → chains to .limit()
      .mockResolvedValueOnce([{ count: 1 }]); // system count

    await expect(archiveSystem(db, SYSTEM_ID, AUTH, REQUEST_META)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "CONFLICT" }),
    );
  });

  it("throws 409 when system has active members", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: "sys_test-system" }]);
    chain.where
      .mockReturnValueOnce(chain) // ownership → chains to .limit()
      .mockResolvedValueOnce([{ count: 2 }]) // system count
      .mockResolvedValueOnce([{ count: 3 }]); // member count

    await expect(archiveSystem(db, SYSTEM_ID, AUTH, REQUEST_META)).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "CONFLICT",
        message: expect.stringContaining("3 active member(s)"),
      }),
    );
  });
});

describe("createSystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a system for system accounts", async () => {
    const { db, chain } = mockDb();
    const newRow = makeSystemRow({ id: "sys_new-system" });
    chain.returning.mockResolvedValueOnce([newRow]);

    const result = await createSystem(db, AUTH, REQUEST_META);

    expect(result.id).toBe("sys_new-system");
    expect(result.encryptedData).toBeNull();
    expect(result.version).toBe(1);
  });

  it("throws 403 for viewer accounts", async () => {
    const { db } = mockDb();
    const viewerAuth: AuthContext = {
      ...AUTH,
      accountType: "viewer",
    };

    await expect(createSystem(db, viewerAuth, REQUEST_META)).rejects.toThrow(
      expect.objectContaining({ status: 403, code: "FORBIDDEN" }),
    );
  });
});
