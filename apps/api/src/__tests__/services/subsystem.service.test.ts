import { toCursor } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { SubsystemId, SystemId } from "@pluralscape/types";

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

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const {
  createSubsystem,
  listSubsystems,
  getSubsystem,
  updateSubsystem,
  deleteSubsystem,
  archiveSubsystem,
  restoreSubsystem,
} = await import("../../services/subsystem.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const SUBSYSTEM_ID = "sub_test-subsystem" as SubsystemId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeSubsystemRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: SUBSYSTEM_ID,
    systemId: SYSTEM_ID,
    parentSubsystemId: null,
    architectureType: null,
    hasCore: false,
    discoveryStatus: null,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    createdAt: 1000,
    updatedAt: 1000,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("createSubsystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a subsystem successfully", async () => {
    const { db, chain } = mockDb();
    // no parent check (parentSubsystemId is null), then INSERT returning
    chain.returning.mockResolvedValueOnce([makeSubsystemRow()]);

    const result = await createSubsystem(
      db,
      SYSTEM_ID,
      {
        encryptedData: VALID_BLOB_BASE64,
        parentSubsystemId: null,
        architectureType: null,
        hasCore: false,
        discoveryStatus: null,
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(SUBSYSTEM_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "subsystem.created" }),
    );
  });

  it("validates parentSubsystemId exists when non-null", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // parent not found

    await expect(
      createSubsystem(
        db,
        SYSTEM_ID,
        {
          encryptedData: VALID_BLOB_BASE64,
          parentSubsystemId: "sub_nonexistent",
          architectureType: null,
          hasCore: false,
          discoveryStatus: null,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      createSubsystem(
        db,
        SYSTEM_ID,
        {
          encryptedData: VALID_BLOB_BASE64,
          parentSubsystemId: null,
          architectureType: null,
          hasCore: false,
          discoveryStatus: null,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(createSubsystem(db, SYSTEM_ID, { bad: "data" }, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("throws 400 for missing required fields", async () => {
    const { db } = mockDb();

    await expect(
      createSubsystem(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64 /* missing hasCore etc */ },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("listSubsystems", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns empty page when no subsystems exist", async () => {
    const { db } = mockDb();

    const result = await listSubsystems(db, SYSTEM_ID, AUTH);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns subsystems for system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeSubsystemRow()]);

    const result = await listSubsystems(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(SUBSYSTEM_ID);
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(listSubsystems(db, SYSTEM_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("detects hasMore when more rows than limit", async () => {
    const { db, chain } = mockDb();
    const rows = [makeSubsystemRow({ id: "sub_a" }), makeSubsystemRow({ id: "sub_b" })];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listSubsystems(db, SYSTEM_ID, AUTH, undefined, 1);

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });

  it("applies cursor filter when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listSubsystems(db, SYSTEM_ID, AUTH, toCursor("sub_cursor-id"));

    expect(chain.where).toHaveBeenCalled();
  });
});

describe("getSubsystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns subsystem for valid ID", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeSubsystemRow()]);

    const result = await getSubsystem(db, SYSTEM_ID, SUBSYSTEM_ID, AUTH);

    expect(result.id).toBe(SUBSYSTEM_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
  });

  it("throws 404 when subsystem not found", async () => {
    const { db } = mockDb();

    await expect(
      getSubsystem(db, SYSTEM_ID, "sub_nonexistent" as SubsystemId, AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(getSubsystem(db, SYSTEM_ID, SUBSYSTEM_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("updateSubsystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates subsystem successfully", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeSubsystemRow({ version: 2 });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateSubsystem(
      db,
      SYSTEM_ID,
      SUBSYSTEM_ID,
      {
        encryptedData: VALID_BLOB_BASE64,
        parentSubsystemId: null,
        architectureType: null,
        hasCore: false,
        discoveryStatus: null,
        version: 1,
      },
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "subsystem.updated" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      updateSubsystem(
        db,
        SYSTEM_ID,
        SUBSYSTEM_ID,
        {
          encryptedData: VALID_BLOB_BASE64,
          parentSubsystemId: null,
          architectureType: null,
          hasCore: false,
          discoveryStatus: null,
          version: 1,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body (missing version)", async () => {
    const { db } = mockDb();

    await expect(
      updateSubsystem(
        db,
        SYSTEM_ID,
        SUBSYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for self-parenting", async () => {
    const { db } = mockDb();

    await expect(
      updateSubsystem(
        db,
        SYSTEM_ID,
        SUBSYSTEM_ID,
        {
          encryptedData: VALID_BLOB_BASE64,
          parentSubsystemId: SUBSYSTEM_ID, // self-reference
          architectureType: null,
          hasCore: false,
          discoveryStatus: null,
          version: 1,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]); // OCC update found nothing
    chain.limit.mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]); // exists check → conflict

    await expect(
      updateSubsystem(
        db,
        SYSTEM_ID,
        SUBSYSTEM_ID,
        {
          encryptedData: VALID_BLOB_BASE64,
          parentSubsystemId: null,
          architectureType: null,
          hasCore: false,
          discoveryStatus: null,
          version: 1,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when subsystem not found during update", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]); // OCC update found nothing
    chain.limit.mockResolvedValueOnce([]); // exists check → not found

    await expect(
      updateSubsystem(
        db,
        SYSTEM_ID,
        SUBSYSTEM_ID,
        {
          encryptedData: VALID_BLOB_BASE64,
          parentSubsystemId: null,
          architectureType: null,
          hasCore: false,
          discoveryStatus: null,
          version: 1,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("updates with non-null parentSubsystemId after successful cycle check", async () => {
    const { db, chain } = mockDb();
    const parentId = "sub_parent" as SubsystemId;
    // Cycle detection: walk from parent → parent has null parent → no cycle
    chain.limit.mockResolvedValueOnce([{ parentSubsystemId: null }]); // ancestor walk terminates
    const updatedRow = makeSubsystemRow({ version: 2, parentSubsystemId: parentId });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateSubsystem(
      db,
      SYSTEM_ID,
      SUBSYSTEM_ID,
      {
        encryptedData: VALID_BLOB_BASE64,
        parentSubsystemId: parentId,
        architectureType: null,
        hasCore: false,
        discoveryStatus: null,
        version: 1,
      },
      AUTH,
      mockAudit,
    );

    expect(result.parentSubsystemId).toBe(parentId);
    expect(result.version).toBe(2);
  });

  it("throws 404 when new parent subsystem not found during cycle check", async () => {
    const { db, chain } = mockDb();
    const parentId = "sub_nonexistent" as SubsystemId;
    // Cycle detection: parent not found
    chain.limit.mockResolvedValueOnce([]); // ancestor walk finds nothing

    await expect(
      updateSubsystem(
        db,
        SYSTEM_ID,
        SUBSYSTEM_ID,
        {
          encryptedData: VALID_BLOB_BASE64,
          parentSubsystemId: parentId,
          architectureType: null,
          hasCore: false,
          discoveryStatus: null,
          version: 1,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 on circular reference", async () => {
    const { db, chain } = mockDb();
    const parentId = "sub_parent" as SubsystemId;
    // Ancestor walk: parent's parentSubsystemId points back to SUBSYSTEM_ID → cycle
    chain.limit.mockResolvedValueOnce([{ parentSubsystemId: SUBSYSTEM_ID }]); // ancestor is SUBSYSTEM_ID itself

    await expect(
      updateSubsystem(
        db,
        SYSTEM_ID,
        SUBSYSTEM_ID,
        {
          encryptedData: VALID_BLOB_BASE64,
          parentSubsystemId: parentId,
          architectureType: null,
          hasCore: false,
          discoveryStatus: null,
          version: 1,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });
});

describe("deleteSubsystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes a subsystem with no dependents", async () => {
    const { db, chain } = mockDb();
    // exists check → chains to .limit()
    chain.where
      .mockReturnValueOnce(chain) // existence check → chains to .limit()
      .mockResolvedValueOnce([{ count: 0 }]) // child subsystems count
      .mockResolvedValueOnce([{ count: 0 }]) // memberships count
      .mockResolvedValueOnce([{ count: 0 }]) // layer link count
      .mockResolvedValueOnce([{ count: 0 }]); // side system link count
    chain.limit.mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]); // exists check

    await deleteSubsystem(db, SYSTEM_ID, SUBSYSTEM_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "subsystem.deleted" }),
    );
  });

  it("throws 409 when subsystem has dependents", async () => {
    const { db, chain } = mockDb();
    chain.where
      .mockReturnValueOnce(chain) // existence check → chains to .limit()
      .mockResolvedValueOnce([{ count: 3 }]) // child subsystems
      .mockResolvedValueOnce([{ count: 0 }]) // memberships
      .mockResolvedValueOnce([{ count: 0 }]) // layer links
      .mockResolvedValueOnce([{ count: 0 }]); // side system links
    chain.limit.mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]);

    await expect(deleteSubsystem(db, SYSTEM_ID, SUBSYSTEM_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "HAS_DEPENDENTS" }),
    );
  });

  it("throws 404 when subsystem not found", async () => {
    const { db } = mockDb();

    await expect(
      deleteSubsystem(db, SYSTEM_ID, "sub_nonexistent" as SubsystemId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(deleteSubsystem(db, SYSTEM_ID, SUBSYSTEM_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("archiveSubsystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives a subsystem", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]); // exists check

    await archiveSubsystem(db, SYSTEM_ID, SUBSYSTEM_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "subsystem.archived" }),
    );
  });

  it("throws 404 when subsystem not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveSubsystem(db, SYSTEM_ID, "sub_nonexistent" as SubsystemId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(archiveSubsystem(db, SYSTEM_ID, SUBSYSTEM_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("restoreSubsystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived subsystem with null parent", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SUBSYSTEM_ID, parentSubsystemId: null }]); // archived subsystem found
    chain.returning.mockResolvedValueOnce([makeSubsystemRow({ version: 2, archived: false })]);

    const result = await restoreSubsystem(db, SYSTEM_ID, SUBSYSTEM_ID, AUTH, mockAudit);

    expect(result.version).toBe(2);
    expect(result.archived).toBe(false);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "subsystem.restored" }),
    );
  });

  it("promotes to root when parent is archived", async () => {
    const { db, chain } = mockDb();
    const parentId = "sub_archived-parent" as SubsystemId;
    chain.limit
      .mockResolvedValueOnce([{ id: SUBSYSTEM_ID, parentSubsystemId: parentId }]) // subsystem found with parent
      .mockResolvedValueOnce([{ archived: true }]); // parent is archived
    chain.returning.mockResolvedValueOnce([
      makeSubsystemRow({ version: 2, parentSubsystemId: null }),
    ]);

    const result = await restoreSubsystem(db, SYSTEM_ID, SUBSYSTEM_ID, AUTH, mockAudit);

    expect(result.parentSubsystemId).toBeNull();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "subsystem.restored" }),
    );
  });

  it("keeps existing parent when parent is not archived", async () => {
    const { db, chain } = mockDb();
    const parentId = "sub_active-parent" as SubsystemId;
    chain.limit
      .mockResolvedValueOnce([{ id: SUBSYSTEM_ID, parentSubsystemId: parentId }]) // subsystem found with parent
      .mockResolvedValueOnce([{ archived: false }]); // parent is active
    chain.returning.mockResolvedValueOnce([
      makeSubsystemRow({ version: 2, parentSubsystemId: parentId }),
    ]);

    const result = await restoreSubsystem(db, SYSTEM_ID, SUBSYSTEM_ID, AUTH, mockAudit);

    expect(result.parentSubsystemId).toBe(parentId);
  });

  it("throws 404 when archived subsystem not found", async () => {
    const { db } = mockDb();

    await expect(
      restoreSubsystem(db, SYSTEM_ID, "sub_nonexistent" as SubsystemId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(restoreSubsystem(db, SYSTEM_ID, SUBSYSTEM_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});
