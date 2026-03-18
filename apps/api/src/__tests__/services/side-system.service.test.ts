import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { SideSystemId, SystemId } from "@pluralscape/types";

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

const {
  createSideSystem,
  listSideSystems,
  getSideSystem,
  updateSideSystem,
  deleteSideSystem,
  archiveSideSystem,
  restoreSideSystem,
} = await import("../../services/side-system.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const SIDE_SYSTEM_ID = "ss_test-side-system" as SideSystemId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeSideSystemRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: SIDE_SYSTEM_ID,
    systemId: SYSTEM_ID,
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

describe("createSideSystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a side system successfully", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeSideSystemRow()]);

    const result = await createSideSystem(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(SIDE_SYSTEM_ID);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "side-system.created" }),
    );
  });

  it("throws 403 for system mismatch", async () => {
    const { db } = mockDb();
    const otherAuth: AuthContext = { ...AUTH, systemId: "sys_other" as SystemId };

    await expect(
      createSideSystem(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, otherAuth, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 403, code: "FORBIDDEN" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(createSideSystem(db, SYSTEM_ID, { bad: "data" }, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });
});

describe("listSideSystems", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns empty page when no side systems exist", async () => {
    const { db } = mockDb();

    const result = await listSideSystems(db, SYSTEM_ID, AUTH);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns side systems for system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeSideSystemRow()]);

    const result = await listSideSystems(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(SIDE_SYSTEM_ID);
  });
});

describe("getSideSystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns side system for valid ID", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeSideSystemRow()]);

    const result = await getSideSystem(db, SYSTEM_ID, SIDE_SYSTEM_ID, AUTH);

    expect(result.id).toBe(SIDE_SYSTEM_ID);
  });

  it("throws 404 when side system not found", async () => {
    const { db } = mockDb();

    await expect(
      getSideSystem(db, SYSTEM_ID, "ss_nonexistent" as SideSystemId, AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("updateSideSystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates side system successfully with version increment", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeSideSystemRow({ version: 2 });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateSideSystem(
      db,
      SYSTEM_ID,
      SIDE_SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "side-system.updated" }),
    );
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]); // update returned nothing (version mismatch)
    chain.limit.mockResolvedValueOnce([{ id: SIDE_SYSTEM_ID }]); // but entity exists

    await expect(
      updateSideSystem(
        db,
        SYSTEM_ID,
        SIDE_SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });
});

describe("deleteSideSystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes a side system with no dependents", async () => {
    const { db, chain } = mockDb();
    chain.where
      .mockReturnValueOnce(chain) // existence check → chains to .limit()
      .mockResolvedValueOnce([{ count: 0 }]) // memberships count
      .mockResolvedValueOnce([{ count: 0 }]) // subsystem-side-system links
      .mockResolvedValueOnce([{ count: 0 }]); // side-system-layer links
    chain.limit.mockResolvedValueOnce([{ id: SIDE_SYSTEM_ID }]);

    await deleteSideSystem(db, SYSTEM_ID, SIDE_SYSTEM_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "side-system.deleted" }),
    );
  });

  it("throws 409 when side system has dependents", async () => {
    const { db, chain } = mockDb();
    chain.where
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce([{ count: 5 }]) // memberships
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);
    chain.limit.mockResolvedValueOnce([{ id: SIDE_SYSTEM_ID }]);

    await expect(deleteSideSystem(db, SYSTEM_ID, SIDE_SYSTEM_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "HAS_DEPENDENTS" }),
    );
  });

  it("throws 404 when side system not found", async () => {
    const { db } = mockDb();

    await expect(
      deleteSideSystem(db, SYSTEM_ID, "ss_nonexistent" as SideSystemId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("archiveSideSystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives a side system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SIDE_SYSTEM_ID }]);

    await archiveSideSystem(db, SYSTEM_ID, SIDE_SYSTEM_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "side-system.archived" }),
    );
  });

  it("throws 404 when side system not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveSideSystem(db, SYSTEM_ID, "ss_nonexistent" as SideSystemId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("restoreSideSystem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived side system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: SIDE_SYSTEM_ID }]); // archived entity found
    chain.returning.mockResolvedValueOnce([makeSideSystemRow({ version: 2 })]);

    const result = await restoreSideSystem(db, SYSTEM_ID, SIDE_SYSTEM_ID, AUTH, mockAudit);

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "side-system.restored" }),
    );
  });

  it("throws 404 when archived side system not found", async () => {
    const { db } = mockDb();

    await expect(
      restoreSideSystem(db, SYSTEM_ID, "ss_nonexistent" as SideSystemId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
