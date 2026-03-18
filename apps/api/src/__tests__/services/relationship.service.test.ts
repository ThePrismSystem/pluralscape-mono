import { toCursor } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { RelationshipId, SystemId } from "@pluralscape/types";

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
  createRelationship,
  listRelationships,
  getRelationship,
  updateRelationship,
  deleteRelationship,
  archiveRelationship,
  restoreRelationship,
} = await import("../../services/relationship.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const RELATIONSHIP_ID = "rel_test-relationship" as RelationshipId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeRelationshipRow(overrides: Record<string, unknown> = {}) {
  return {
    id: RELATIONSHIP_ID,
    systemId: SYSTEM_ID,
    sourceMemberId: "mem_source",
    targetMemberId: "mem_target",
    type: "sibling",
    bidirectional: true,
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

describe("createRelationship", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a relationship and writes audit log", async () => {
    const { db, chain } = mockDb();
    const row = makeRelationshipRow();

    // Member existence check: single SELECT with or() — terminal where()
    chain.where.mockResolvedValueOnce([{ id: "mem_source" }, { id: "mem_target" }]);
    // Insert returning
    chain.returning.mockResolvedValueOnce([row]);

    const result = await createRelationship(
      db,
      SYSTEM_ID,
      {
        sourceMemberId: "mem_source",
        targetMemberId: "mem_target",
        type: "sibling",
        bidirectional: true,
        encryptedData: VALID_BLOB_BASE64,
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(RELATIONSHIP_ID);
    expect(result.sourceMemberId).toBe("mem_source");
    expect(result.targetMemberId).toBe("mem_target");
    expect(result.type).toBe("sibling");
    expect(result.bidirectional).toBe(true);
    expect(result.version).toBe(1);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "relationship.created" }),
    );
  });

  it("throws 404 when source member not found", async () => {
    const { db, chain } = mockDb();

    // Only target member found — source missing
    chain.where.mockResolvedValueOnce([{ id: "mem_target" }]);

    await expect(
      createRelationship(
        db,
        SYSTEM_ID,
        {
          sourceMemberId: "mem_source",
          targetMemberId: "mem_target",
          type: "sibling",
          bidirectional: true,
          encryptedData: VALID_BLOB_BASE64,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 when target member not found", async () => {
    const { db, chain } = mockDb();

    // Only source member found — target missing
    chain.where.mockResolvedValueOnce([{ id: "mem_source" }]);

    await expect(
      createRelationship(
        db,
        SYSTEM_ID,
        {
          sourceMemberId: "mem_source",
          targetMemberId: "mem_target",
          type: "sibling",
          bidirectional: true,
          encryptedData: VALID_BLOB_BASE64,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 for system ownership failure", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(assertSystemOwnership).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "System not found"),
    );
    const { db } = mockDb();

    await expect(
      createRelationship(
        db,
        SYSTEM_ID,
        {
          sourceMemberId: "mem_source",
          targetMemberId: "mem_target",
          type: "sibling",
          bidirectional: true,
          encryptedData: VALID_BLOB_BASE64,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(
      createRelationship(db, SYSTEM_ID, { invalid: true }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for invalid relationship type", async () => {
    const { db } = mockDb();

    await expect(
      createRelationship(
        db,
        SYSTEM_ID,
        {
          sourceMemberId: "mem_source",
          targetMemberId: "mem_target",
          type: "not-a-valid-type",
          bidirectional: true,
          encryptedData: VALID_BLOB_BASE64,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("listRelationships", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns relationships for the system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeRelationshipRow()]);

    const result = await listRelationships(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(RELATIONSHIP_ID);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.totalCount).toBeNull();
  });

  it("returns relationships filtered by memberId", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeRelationshipRow()]);

    const result = await listRelationships(db, SYSTEM_ID, AUTH, undefined, 25, "mem_source");

    expect(result.items).toHaveLength(1);
    expect(chain.where).toHaveBeenCalled();
  });

  it("returns empty page when no relationships exist", async () => {
    const { db } = mockDb();

    const result = await listRelationships(db, SYSTEM_ID, AUTH);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("detects hasMore when more rows than limit", async () => {
    const { db, chain } = mockDb();
    const rows = [makeRelationshipRow({ id: "rel_a" }), makeRelationshipRow({ id: "rel_b" })];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listRelationships(db, SYSTEM_ID, AUTH, undefined, 1);

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
  });

  it("applies cursor filter when cursor is provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listRelationships(db, SYSTEM_ID, AUTH, toCursor("rel_cursor-id"));

    expect(chain.where).toHaveBeenCalled();
  });
});

describe("getRelationship", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns relationship when found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeRelationshipRow()]);

    const result = await getRelationship(db, SYSTEM_ID, RELATIONSHIP_ID, AUTH);

    expect(result.id).toBe(RELATIONSHIP_ID);
    expect(result.type).toBe("sibling");
    expect(result.bidirectional).toBe(true);
  });

  it("throws 404 when relationship not found", async () => {
    const { db } = mockDb();

    await expect(
      getRelationship(db, SYSTEM_ID, "rel_nonexistent" as RelationshipId, AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("updateRelationship", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates relationship with version increment", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeRelationshipRow({ version: 2 });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateRelationship(
      db,
      SYSTEM_ID,
      RELATIONSHIP_ID,
      { type: "partner", bidirectional: false, encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(RELATIONSHIP_ID);
    expect(result.version).toBe(2);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "relationship.updated" }),
    );
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    // Update returning empty (version mismatch)
    chain.returning.mockResolvedValueOnce([]);
    // Follow-up SELECT finds existing — conflict, not 404
    chain.limit.mockResolvedValueOnce([{ id: RELATIONSHIP_ID }]);

    await expect(
      updateRelationship(
        db,
        SYSTEM_ID,
        RELATIONSHIP_ID,
        { type: "sibling", bidirectional: true, encryptedData: VALID_BLOB_BASE64, version: 99 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when relationship not found", async () => {
    const { db, chain } = mockDb();
    // Update returning empty
    chain.returning.mockResolvedValueOnce([]);
    // Follow-up SELECT finds nothing — not found
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateRelationship(
        db,
        SYSTEM_ID,
        "rel_nonexistent" as RelationshipId,
        { type: "sibling", bidirectional: true, encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(
      updateRelationship(db, SYSTEM_ID, RELATIONSHIP_ID, { invalid: true }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("deleteRelationship", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes a relationship and writes audit log", async () => {
    const { db, chain } = mockDb();
    // Verify exists check
    chain.limit.mockResolvedValueOnce([{ id: RELATIONSHIP_ID }]);

    await deleteRelationship(db, SYSTEM_ID, RELATIONSHIP_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(chain.delete).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "relationship.deleted" }),
    );
  });

  it("throws 404 when relationship not found", async () => {
    const { db } = mockDb();

    await expect(
      deleteRelationship(db, SYSTEM_ID, "rel_nonexistent" as RelationshipId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("archiveRelationship", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives a relationship", async () => {
    const { db, chain } = mockDb();
    // Verify exists check
    chain.limit.mockResolvedValueOnce([{ id: RELATIONSHIP_ID }]);

    await archiveRelationship(db, SYSTEM_ID, RELATIONSHIP_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(chain.update).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "relationship.archived" }),
    );
  });

  it("throws 404 when relationship not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveRelationship(db, SYSTEM_ID, "rel_nonexistent" as RelationshipId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("restoreRelationship", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived relationship", async () => {
    const { db, chain } = mockDb();
    // Find archived relationship
    chain.limit.mockResolvedValueOnce([{ id: RELATIONSHIP_ID }]);
    // Update returning
    const restoredRow = makeRelationshipRow({ archived: false, archivedAt: null, version: 2 });
    chain.returning.mockResolvedValueOnce([restoredRow]);

    const result = await restoreRelationship(db, SYSTEM_ID, RELATIONSHIP_ID, AUTH, mockAudit);

    expect(result.id).toBe(RELATIONSHIP_ID);
    expect(result.archived).toBe(false);
    expect(result.archivedAt).toBeNull();
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "relationship.restored" }),
    );
  });

  it("throws 404 when archived relationship not found", async () => {
    const { db } = mockDb();

    await expect(
      restoreRelationship(db, SYSTEM_ID, "rel_nonexistent" as RelationshipId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
