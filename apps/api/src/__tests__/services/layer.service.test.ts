import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { LayerId, SystemId } from "@pluralscape/types";

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

const { createLayer, listLayers, getLayer, updateLayer, deleteLayer, archiveLayer, restoreLayer } =
  await import("../../services/layer.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const LAYER_ID = "lyr_test-layer" as LayerId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeLayerRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: LAYER_ID,
    systemId: SYSTEM_ID,
    sortOrder: 0,
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

describe("createLayer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a layer successfully with sortOrder", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeLayerRow({ sortOrder: 2 })]);

    const result = await createLayer(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, sortOrder: 2 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(LAYER_ID);
    expect(result.sortOrder).toBe(2);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "layer.created" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      createLayer(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, sortOrder: 0 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(createLayer(db, SYSTEM_ID, { bad: "data" }, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });
});

describe("listLayers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns empty page when no layers exist", async () => {
    const { db } = mockDb();

    const result = await listLayers(db, SYSTEM_ID, AUTH);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns layers for system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLayerRow()]);

    const result = await listLayers(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(LAYER_ID);
  });
});

describe("getLayer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns layer for valid ID", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeLayerRow()]);

    const result = await getLayer(db, SYSTEM_ID, LAYER_ID, AUTH);

    expect(result.id).toBe(LAYER_ID);
  });

  it("throws 404 when layer not found", async () => {
    const { db } = mockDb();

    await expect(getLayer(db, SYSTEM_ID, "lyr_nonexistent" as LayerId, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("updateLayer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates layer successfully with version increment and sortOrder update", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeLayerRow({ version: 2, sortOrder: 5 });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateLayer(
      db,
      SYSTEM_ID,
      LAYER_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1, sortOrder: 5 },
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(result.sortOrder).toBe(5);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "layer.updated" }),
    );
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]); // update returned nothing (version mismatch)
    chain.limit.mockResolvedValueOnce([{ id: LAYER_ID }]); // but entity exists

    await expect(
      updateLayer(
        db,
        SYSTEM_ID,
        LAYER_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1, sortOrder: 0 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });
});

describe("deleteLayer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes a layer with no dependents", async () => {
    const { db, chain } = mockDb();
    chain.where
      .mockReturnValueOnce(chain) // existence check → chains to .limit()
      .mockResolvedValueOnce([{ count: 0 }]) // membership count
      .mockResolvedValueOnce([{ count: 0 }]) // subsystem link count
      .mockResolvedValueOnce([{ count: 0 }]); // side system link count
    chain.limit.mockResolvedValueOnce([{ id: LAYER_ID }]); // exists check

    await deleteLayer(db, SYSTEM_ID, LAYER_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "layer.deleted" }),
    );
  });

  it("throws 409 when layer has dependents", async () => {
    const { db, chain } = mockDb();
    chain.where
      .mockReturnValueOnce(chain) // existence → .limit()
      .mockResolvedValueOnce([{ count: 2 }]) // membership count
      .mockResolvedValueOnce([{ count: 0 }]) // subsystem link count
      .mockResolvedValueOnce([{ count: 0 }]); // side system link count
    chain.limit.mockResolvedValueOnce([{ id: LAYER_ID }]); // exists check

    await expect(deleteLayer(db, SYSTEM_ID, LAYER_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "HAS_DEPENDENTS" }),
    );
  });

  it("throws 404 when layer not found", async () => {
    const { db } = mockDb();

    await expect(
      deleteLayer(db, SYSTEM_ID, "lyr_nonexistent" as LayerId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("archiveLayer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives a layer", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: LAYER_ID }]);

    await archiveLayer(db, SYSTEM_ID, LAYER_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "layer.archived" }),
    );
  });

  it("throws 404 when layer not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveLayer(db, SYSTEM_ID, "lyr_nonexistent" as LayerId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("restoreLayer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived layer", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: LAYER_ID }]); // archived entity found
    chain.returning.mockResolvedValueOnce([makeLayerRow({ version: 2 })]);

    const result = await restoreLayer(db, SYSTEM_ID, LAYER_ID, AUTH, mockAudit);

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "layer.restored" }),
    );
  });

  it("throws 404 when archived layer not found", async () => {
    const { db } = mockDb();

    await expect(
      restoreLayer(db, SYSTEM_ID, "lyr_nonexistent" as LayerId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
