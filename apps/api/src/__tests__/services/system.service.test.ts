import { toCursor } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";

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
const { listSystems, getSystemProfile, updateSystemProfile, archiveSystem, createSystem } =
  await import("../../services/system.service.js");
// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

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

describe("listSystems", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns empty page when no systems exist", async () => {
    const { db } = mockDb();

    const result = await listSystems(db, AUTH.accountId);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.totalCount).toBeNull();
  });

  it("returns systems owned by the account", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeSystemRow()]);

    const result = await listSystems(db, AUTH.accountId);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("sys_test-system");
    expect(result.hasMore).toBe(false);
  });

  it("detects hasMore when more rows than limit", async () => {
    const { db, chain } = mockDb();
    // Request limit=1, so service fetches 2 rows
    const rows = [makeSystemRow({ id: "sys_a" }), makeSystemRow({ id: "sys_b" })];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listSystems(db, AUTH.accountId, undefined, 1);

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("sys_a");
  });

  it("caps limit to MAX_SYSTEM_LIMIT", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listSystems(db, AUTH.accountId, undefined, 999);

    // limit mock was called with MAX_SYSTEM_LIMIT + 1 = 101
    expect(chain.limit).toHaveBeenCalledWith(101);
  });

  it("uses default limit when not specified", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listSystems(db, AUTH.accountId);

    // DEFAULT_SYSTEM_LIMIT + 1 = 26
    expect(chain.limit).toHaveBeenCalledWith(26);
  });

  it("applies cursor filter when cursor provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listSystems(db, AUTH.accountId, toCursor("sys_cursor-id"));

    expect(chain.where).toHaveBeenCalled();
  });

  it("returns totalCount as null", async () => {
    const { db } = mockDb();

    const result = await listSystems(db, AUTH.accountId);

    expect(result.totalCount).toBeNull();
  });
});

describe("getSystemProfile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
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
    mockAudit.mockClear();
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
      mockAudit,
    );

    expect(result.id).toBe("sys_test-system");
    expect(result.version).toBe(2);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
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
        mockAudit,
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
        mockAudit,
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
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for oversized encryptedData", async () => {
    const { db } = mockDb();
    // Must exceed MAX_ENCRYPTED_SYSTEM_DATA_SIZE (131,072 base64 chars = ~98 KiB)
    const oversized = Buffer.from(new Uint8Array(100_000)).toString("base64");

    await expect(
      updateSystemProfile(db, SYSTEM_ID, { encryptedData: oversized, version: 1 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for invalid body (missing version)", async () => {
    const { db } = mockDb();

    await expect(
      updateSystemProfile(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("archiveSystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
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

    await archiveSystem(db, SYSTEM_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "system.deleted" }),
    );
  });

  it("throws 404 when system not found", async () => {
    const { db } = mockDb();

    await expect(archiveSystem(db, "sys_nonexistent" as SystemId, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws 409 when it is the last system", async () => {
    const { db, chain } = mockDb();
    // ownership check finds the system
    chain.limit.mockResolvedValueOnce([{ id: "sys_test-system" }]);
    // system count = 1 (last system), member count not reached
    chain.where
      .mockReturnValueOnce(chain) // ownership → chains to .limit()
      .mockResolvedValueOnce([{ count: 1 }]); // system count

    await expect(archiveSystem(db, SYSTEM_ID, AUTH, mockAudit)).rejects.toThrow(
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

    await expect(archiveSystem(db, SYSTEM_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "HAS_DEPENDENTS",
        message: expect.stringContaining("3 active member(s)"),
      }),
    );
  });
});

describe("createSystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a system for system accounts", async () => {
    const { db, chain } = mockDb();
    const newRow = makeSystemRow({ id: "sys_new-system" });
    chain.returning.mockResolvedValueOnce([newRow]);

    const result = await createSystem(db, AUTH, mockAudit);

    expect(result.id).toBe("sys_new-system");
    expect(result.encryptedData).toBeNull();
    expect(result.version).toBe(1);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "system.created" }),
    );
  });

  it("throws 403 for viewer accounts", async () => {
    const { db } = mockDb();
    const viewerAuth: AuthContext = {
      ...AUTH,
      accountType: "viewer",
    };

    await expect(createSystem(db, viewerAuth, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 403, code: "FORBIDDEN" }),
    );
  });
});
