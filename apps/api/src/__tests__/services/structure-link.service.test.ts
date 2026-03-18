import { afterEach, describe, expect, it, vi } from "vitest";

import { PG_UNIQUE_VIOLATION } from "../../db.constants.js";
import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

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

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

// ── Import under test ────────────────────────────────────────────────

const {
  createSubsystemLayerLink,
  deleteSubsystemLayerLink,
  listSubsystemLayerLinks,
  createSubsystemSideSystemLink,
  deleteSubsystemSideSystemLink,
  listSubsystemSideSystemLinks,
  createSideSystemLayerLink,
  deleteSideSystemLayerLink,
  listSideSystemLayerLinks,
} = await import("../../services/structure-link.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

const { InvalidInputError, deserializeEncryptedBlob } = await import("@pluralscape/crypto");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const SUBSYSTEM_ID = "sub_test";
const LAYER_ID = "lyr_test";
const SIDE_SYSTEM_ID = "ssys_test";
const LINK_ID = "slink_test";

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeSubsystemLayerLinkRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: LINK_ID,
    subsystemId: SUBSYSTEM_ID,
    layerId: LAYER_ID,
    systemId: SYSTEM_ID,
    encryptedData: new Uint8Array([1, 2, 3]),
    createdAt: 1000,
    ...overrides,
  };
}

function makeSubsystemSideSystemLinkRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: LINK_ID,
    subsystemId: SUBSYSTEM_ID,
    sideSystemId: SIDE_SYSTEM_ID,
    systemId: SYSTEM_ID,
    encryptedData: null,
    createdAt: 1000,
    ...overrides,
  };
}

function makeSideSystemLayerLinkRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: LINK_ID,
    sideSystemId: SIDE_SYSTEM_ID,
    layerId: LAYER_ID,
    systemId: SYSTEM_ID,
    encryptedData: null,
    createdAt: 1000,
    ...overrides,
  };
}

// ── SUBSYSTEM ↔ LAYER LINKS ──────────────────────────────────────────

describe("createSubsystemLayerLink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a link with encryptedData and writes audit log", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]) // subsystem exists
      .mockResolvedValueOnce([{ id: LAYER_ID }]); // layer exists
    chain.returning.mockResolvedValueOnce([makeSubsystemLayerLinkRow()]);

    const result = await createSubsystemLayerLink(
      db,
      SYSTEM_ID,
      { subsystemId: SUBSYSTEM_ID, layerId: LAYER_ID, encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(LINK_ID);
    expect(result.entityAId).toBe(SUBSYSTEM_ID);
    expect(result.entityBId).toBe(LAYER_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.encryptedData).toBeDefined();
    expect(result.createdAt).toBe(1000);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "structure-link.created" }),
    );
  });

  it("creates a link without encryptedData", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]) // subsystem exists
      .mockResolvedValueOnce([{ id: LAYER_ID }]); // layer exists
    chain.returning.mockResolvedValueOnce([makeSubsystemLayerLinkRow({ encryptedData: null })]);

    const result = await createSubsystemLayerLink(
      db,
      SYSTEM_ID,
      { subsystemId: SUBSYSTEM_ID, layerId: LAYER_ID },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(LINK_ID);
    expect(result.encryptedData).toBeNull();
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      createSubsystemLayerLink(
        db,
        SYSTEM_ID,
        { subsystemId: SUBSYSTEM_ID, layerId: LAYER_ID },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(createSubsystemLayerLink(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("throws 400 for malformed encrypted blob", async () => {
    const { db } = mockDb();
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new InvalidInputError("bad blob");
    });

    await expect(
      createSubsystemLayerLink(
        db,
        SYSTEM_ID,
        {
          subsystemId: SUBSYSTEM_ID,
          layerId: LAYER_ID,
          encryptedData: Buffer.from(new Uint8Array(40)).toString("base64"),
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("re-throws non-crypto deserialization errors", async () => {
    const { db } = mockDb();
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new TypeError("unexpected");
    });

    await expect(
      createSubsystemLayerLink(
        db,
        SYSTEM_ID,
        {
          subsystemId: SUBSYSTEM_ID,
          layerId: LAYER_ID,
          encryptedData: Buffer.from(new Uint8Array(40)).toString("base64"),
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(TypeError);
  });

  it("throws 404 when subsystem not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // subsystem not found

    await expect(
      createSubsystemLayerLink(
        db,
        SYSTEM_ID,
        { subsystemId: SUBSYSTEM_ID, layerId: LAYER_ID },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 when layer not found", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]) // subsystem found
      .mockResolvedValueOnce([]); // layer not found

    await expect(
      createSubsystemLayerLink(
        db,
        SYSTEM_ID,
        { subsystemId: SUBSYSTEM_ID, layerId: LAYER_ID },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 on unique constraint violation", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]) // subsystem exists
      .mockResolvedValueOnce([{ id: LAYER_ID }]); // layer exists
    chain.returning.mockRejectedValueOnce(
      Object.assign(new Error("unique violation"), { code: PG_UNIQUE_VIOLATION }),
    );

    await expect(
      createSubsystemLayerLink(
        db,
        SYSTEM_ID,
        { subsystemId: SUBSYSTEM_ID, layerId: LAYER_ID },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });
});

describe("deleteSubsystemLayerLink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes a link and writes audit log", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: LINK_ID }]);

    await deleteSubsystemLayerLink(db, SYSTEM_ID, LINK_ID, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "structure-link.deleted" }),
    );
  });

  it("throws 404 when link not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(deleteSubsystemLayerLink(db, SYSTEM_ID, LINK_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("listSubsystemLayerLinks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns links for system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeSubsystemLayerLinkRow()]);

    const result = await listSubsystemLayerLinks(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(LINK_ID);
    expect(result.items[0]?.entityAId).toBe(SUBSYSTEM_ID);
    expect(result.items[0]?.entityBId).toBe(LAYER_ID);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.totalCount).toBeNull();
  });

  it("filters by subsystemId and layerId", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeSubsystemLayerLinkRow()]);

    const result = await listSubsystemLayerLinks(
      db,
      SYSTEM_ID,
      AUTH,
      undefined,
      25,
      SUBSYSTEM_ID,
      LAYER_ID,
    );

    expect(result.items).toHaveLength(1);
    expect(chain.where).toHaveBeenCalled();
  });
});

// ── SUBSYSTEM ↔ SIDE SYSTEM LINKS ───────────────────────────────────

describe("createSubsystemSideSystemLink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a subsystem-side system link and writes audit log", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]) // subsystem exists
      .mockResolvedValueOnce([{ id: SIDE_SYSTEM_ID }]); // side system exists
    chain.returning.mockResolvedValueOnce([makeSubsystemSideSystemLinkRow()]);

    const result = await createSubsystemSideSystemLink(
      db,
      SYSTEM_ID,
      { subsystemId: SUBSYSTEM_ID, sideSystemId: SIDE_SYSTEM_ID },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(LINK_ID);
    expect(result.entityAId).toBe(SUBSYSTEM_ID);
    expect(result.entityBId).toBe(SIDE_SYSTEM_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.encryptedData).toBeNull();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "structure-link.created" }),
    );
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(
      createSubsystemSideSystemLink(db, SYSTEM_ID, { bad: "data" }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 404 when side system not found", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]) // subsystem found
      .mockResolvedValueOnce([]); // side system not found

    await expect(
      createSubsystemSideSystemLink(
        db,
        SYSTEM_ID,
        { subsystemId: SUBSYSTEM_ID, sideSystemId: "ss_nonexistent" },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("deleteSubsystemSideSystemLink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes a subsystem-side system link and writes audit log", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: LINK_ID }]);

    await deleteSubsystemSideSystemLink(db, SYSTEM_ID, LINK_ID, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "structure-link.deleted" }),
    );
  });

  it("throws 404 when link not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      deleteSubsystemSideSystemLink(db, SYSTEM_ID, LINK_ID, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("listSubsystemSideSystemLinks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns links for system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeSubsystemSideSystemLinkRow()]);

    const result = await listSubsystemSideSystemLinks(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.entityAId).toBe(SUBSYSTEM_ID);
    expect(result.items[0]?.entityBId).toBe(SIDE_SYSTEM_ID);
    expect(result.hasMore).toBe(false);
  });
});

// ── SIDE SYSTEM ↔ LAYER LINKS ────────────────────────────────────────

describe("createSideSystemLayerLink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a side system-layer link and writes audit log", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SIDE_SYSTEM_ID }]) // side system exists
      .mockResolvedValueOnce([{ id: LAYER_ID }]); // layer exists
    chain.returning.mockResolvedValueOnce([makeSideSystemLayerLinkRow()]);

    const result = await createSideSystemLayerLink(
      db,
      SYSTEM_ID,
      { sideSystemId: SIDE_SYSTEM_ID, layerId: LAYER_ID },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(LINK_ID);
    expect(result.entityAId).toBe(SIDE_SYSTEM_ID);
    expect(result.entityBId).toBe(LAYER_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.encryptedData).toBeNull();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "structure-link.created" }),
    );
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(
      createSideSystemLayerLink(db, SYSTEM_ID, { bad: "data" }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 404 when layer not found", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SIDE_SYSTEM_ID }]) // side system found
      .mockResolvedValueOnce([]); // layer not found

    await expect(
      createSideSystemLayerLink(
        db,
        SYSTEM_ID,
        { sideSystemId: SIDE_SYSTEM_ID, layerId: "lyr_nonexistent" },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("deleteSideSystemLayerLink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes a side system-layer link and writes audit log", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: LINK_ID }]);

    await deleteSideSystemLayerLink(db, SYSTEM_ID, LINK_ID, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "structure-link.deleted" }),
    );
  });

  it("throws 404 when link not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      deleteSideSystemLayerLink(db, SYSTEM_ID, LINK_ID, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("listSideSystemLayerLinks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns links for system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeSideSystemLayerLinkRow()]);

    const result = await listSideSystemLayerLinks(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.entityAId).toBe(SIDE_SYSTEM_ID);
    expect(result.items[0]?.entityBId).toBe(LAYER_ID);
    expect(result.hasMore).toBe(false);
  });

  it("filters by sideSystemId and layerId", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeSideSystemLayerLinkRow()]);

    const result = await listSideSystemLayerLinks(
      db,
      SYSTEM_ID,
      AUTH,
      undefined,
      25,
      SIDE_SYSTEM_ID,
      LAYER_ID,
    );

    expect(result.items).toHaveLength(1);
    expect(chain.where).toHaveBeenCalled();
  });
});

describe("createSubsystemSideSystemLink duplicate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("throws 409 on unique constraint violation", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: "sub_test" }])
      .mockResolvedValueOnce([{ id: "ss_test" }]);
    chain.returning.mockRejectedValueOnce(
      Object.assign(new Error("unique_violation"), { code: PG_UNIQUE_VIOLATION }),
    );

    await expect(
      createSubsystemSideSystemLink(
        db,
        SYSTEM_ID,
        { subsystemId: "sub_test", sideSystemId: "ss_test" },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });
});

describe("createSideSystemLayerLink duplicate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("throws 409 on unique constraint violation", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: "ss_test" }])
      .mockResolvedValueOnce([{ id: "lyr_test" }]);
    chain.returning.mockRejectedValueOnce(
      Object.assign(new Error("unique_violation"), { code: PG_UNIQUE_VIOLATION }),
    );

    await expect(
      createSideSystemLayerLink(
        db,
        SYSTEM_ID,
        { sideSystemId: "ss_test", layerId: "lyr_test" },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });
});

describe("listSubsystemSideSystemLinks with sideSystemId filter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies sideSystemId filter", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const result = await listSubsystemSideSystemLinks(
      db,
      SYSTEM_ID,
      AUTH,
      undefined,
      25,
      undefined,
      "ss_filter",
    );

    expect(result.items).toHaveLength(0);
    expect(chain.where).toHaveBeenCalled();
  });
});
