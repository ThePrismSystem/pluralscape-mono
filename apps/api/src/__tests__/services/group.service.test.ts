import { toCursor } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { GroupId, SystemId } from "@pluralscape/types";

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

const { InvalidInputError } = await import("@pluralscape/crypto");
const {
  createGroup,
  listGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  moveGroup,
  getGroupTree,
  reorderGroups,
  archiveGroup,
  restoreGroup,
  copyGroup,
} = await import("../../services/group.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const GROUP_ID = "grp_test-group" as GroupId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeGroupRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: GROUP_ID,
    systemId: SYSTEM_ID,
    parentGroupId: null,
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

describe("createGroup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a group successfully", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // no parent check needed (parentGroupId is null)
    chain.returning.mockResolvedValueOnce([makeGroupRow()]);

    const result = await createGroup(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64, parentGroupId: null, sortOrder: 0 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(GROUP_ID);
    expect(result.sortOrder).toBe(0);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "group.created" }),
    );
  });

  it("validates parentGroupId exists when non-null", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // parent not found

    await expect(
      createGroup(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, parentGroupId: "grp_nonexistent", sortOrder: 0 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      createGroup(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, parentGroupId: null, sortOrder: 0 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(createGroup(db, SYSTEM_ID, { bad: "data" }, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });

  it("throws 400 for oversized encryptedData", async () => {
    const { db } = mockDb();
    const oversized = Buffer.from(new Uint8Array(70_000)).toString("base64");

    await expect(
      createGroup(
        db,
        SYSTEM_ID,
        { encryptedData: oversized, parentGroupId: null, sortOrder: 0 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for malformed blob", async () => {
    const { db } = mockDb();
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new InvalidInputError("Invalid blob");
    });

    await expect(
      createGroup(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, parentGroupId: null, sortOrder: 0 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("listGroups", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("returns empty page when no groups exist", async () => {
    const { db } = mockDb();

    const result = await listGroups(db, SYSTEM_ID, AUTH);

    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns groups for system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeGroupRow()]);

    const result = await listGroups(db, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(GROUP_ID);
  });

  it("detects hasMore when more rows than limit", async () => {
    const { db, chain } = mockDb();
    const rows = [makeGroupRow({ id: "grp_a" }), makeGroupRow({ id: "grp_b" })];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listGroups(db, SYSTEM_ID, AUTH, undefined, 1);

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });

  it("caps limit to MAX_GROUP_LIMIT", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listGroups(db, SYSTEM_ID, AUTH, undefined, 999);

    expect(chain.limit).toHaveBeenCalledWith(101);
  });

  it("applies cursor filter when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listGroups(db, SYSTEM_ID, AUTH, toCursor("grp_cursor-id"));

    expect(chain.where).toHaveBeenCalled();
  });
});

describe("getGroup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns group for valid ID", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeGroupRow()]);

    const result = await getGroup(db, SYSTEM_ID, GROUP_ID, AUTH);

    expect(result.id).toBe(GROUP_ID);
  });

  it("throws 404 when group not found", async () => {
    const { db } = mockDb();

    await expect(getGroup(db, SYSTEM_ID, "grp_nonexistent" as GroupId, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("updateGroup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates group successfully with version increment", async () => {
    const { db, chain } = mockDb();
    const updatedRow = makeGroupRow({ version: 2 });
    chain.returning.mockResolvedValueOnce([updatedRow]);

    const result = await updateGroup(
      db,
      SYSTEM_ID,
      GROUP_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "group.updated" }),
    );
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);

    await expect(
      updateGroup(
        db,
        SYSTEM_ID,
        GROUP_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when group not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateGroup(
        db,
        SYSTEM_ID,
        GROUP_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(
      updateGroup(db, SYSTEM_ID, GROUP_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("deleteGroup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes an empty group", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);
    chain.where
      .mockReturnValueOnce(chain) // existence check → chains to .limit()
      .mockResolvedValueOnce([{ count: 0 }]) // child groups count
      .mockResolvedValueOnce([{ count: 0 }]); // memberships count

    await deleteGroup(db, SYSTEM_ID, GROUP_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "group.deleted" }),
    );
  });

  it("throws 404 when group not found", async () => {
    const { db } = mockDb();

    await expect(
      deleteGroup(db, SYSTEM_ID, "grp_nonexistent" as GroupId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 when group has dependents", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);
    chain.where
      .mockReturnValueOnce(chain) // existence → .limit()
      .mockResolvedValueOnce([{ count: 2 }]) // child groups
      .mockResolvedValueOnce([{ count: 3 }]); // memberships

    await expect(deleteGroup(db, SYSTEM_ID, GROUP_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "HAS_DEPENDENTS",
        message: expect.stringContaining("2 child group(s)"),
      }),
    );
  });

  it("runs dependent checks in parallel via Promise.all", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);

    // Use manually-controlled deferred promises. If the implementation dispatches
    // queries sequentially, it will block on the first unresolved promise and never
    // reach the second .where() call. With Promise.all, both .where() calls happen
    // synchronously before either promise resolves.
    let resolve1!: (v: { count: number }[]) => void;
    let resolve2!: (v: { count: number }[]) => void;

    chain.where
      .mockReturnValueOnce(chain) // existence → .limit()
      .mockReturnValueOnce(
        new Promise<{ count: number }[]>((r) => {
          resolve1 = r;
        }),
      )
      .mockReturnValueOnce(
        new Promise<{ count: number }[]>((r) => {
          resolve2 = r;
        }),
      );

    // Start deleteGroup without awaiting — sequential impl would deadlock here
    const done = deleteGroup(db, SYSTEM_ID, GROUP_ID, AUTH, mockAudit);

    // Flush microtasks so existence check resolves and dependent queries dispatch
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });

    // Both dependent-check .where() calls dispatched before either resolved
    expect(chain.where).toHaveBeenCalledTimes(3); // 1 existence + 2 dependents

    resolve1([{ count: 0 }]);
    resolve2([{ count: 0 }]);
    await done;

    expect(chain.select).toHaveBeenCalledTimes(3);
  });
});

describe("moveGroup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("moves group to new parent", async () => {
    const { db, chain } = mockDb();
    const parentId = "grp_parent" as GroupId;
    // target parent lookup
    chain.limit
      .mockResolvedValueOnce([{ id: parentId, parentGroupId: null }])
      // ancestor walk: parent has null parent → no cycle
      .mockResolvedValueOnce([{ parentGroupId: null }]);
    // OCC update
    chain.returning.mockResolvedValueOnce([makeGroupRow({ parentGroupId: parentId, version: 2 })]);

    const result = await moveGroup(
      db,
      SYSTEM_ID,
      GROUP_ID,
      { targetParentGroupId: parentId, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.parentGroupId).toBe(parentId);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "group.moved" }),
    );
  });

  it("moves group to root", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeGroupRow({ parentGroupId: null, version: 2 })]);

    const result = await moveGroup(
      db,
      SYSTEM_ID,
      GROUP_ID,
      { targetParentGroupId: null, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.parentGroupId).toBeNull();
  });

  it("throws 400 for self-parenting", async () => {
    const { db } = mockDb();

    await expect(
      moveGroup(
        db,
        SYSTEM_ID,
        GROUP_ID,
        { targetParentGroupId: GROUP_ID, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 404 for nonexistent target parent", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // target not found

    await expect(
      moveGroup(
        db,
        SYSTEM_ID,
        GROUP_ID,
        { targetParentGroupId: "grp_nonexistent", version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 on circular reference", async () => {
    const { db, chain } = mockDb();
    const childId = "grp_child" as GroupId;
    // target exists, its parent is GROUP_ID → cycle
    chain.limit
      .mockResolvedValueOnce([{ id: childId, parentGroupId: GROUP_ID }])
      .mockResolvedValueOnce([{ parentGroupId: GROUP_ID }]);

    await expect(
      moveGroup(
        db,
        SYSTEM_ID,
        GROUP_ID,
        { targetParentGroupId: childId, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });
});

describe("getGroupTree", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array when no groups", async () => {
    const { db, chain } = mockDb();
    chain.orderBy.mockResolvedValueOnce([]);

    const result = await getGroupTree(db, SYSTEM_ID, AUTH);

    expect(result).toEqual([]);
  });

  it("assembles nested tree from flat rows", async () => {
    const { db, chain } = mockDb();
    const parent = makeGroupRow({ id: "grp_parent", parentGroupId: null });
    const child = makeGroupRow({ id: "grp_child", parentGroupId: "grp_parent" });
    chain.orderBy.mockResolvedValueOnce([parent, child]);

    const result = await getGroupTree(db, SYSTEM_ID, AUTH);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("grp_parent");
    expect(result[0]?.children).toHaveLength(1);
    expect(result[0]?.children[0]?.id).toBe("grp_child");
  });
});

describe("reorderGroups", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("reorders groups successfully", async () => {
    const { db, chain } = mockDb();
    // Pre-flight existence check
    chain.where.mockResolvedValueOnce([{ id: GROUP_ID }]);
    chain.returning.mockResolvedValue([{ id: GROUP_ID }]);

    await reorderGroups(
      db,
      SYSTEM_ID,
      { operations: [{ groupId: GROUP_ID, sortOrder: 5 }] },
      AUTH,
      mockAudit,
    );

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({
        eventType: "group.updated",
        detail: "Reordered 1 group(s)",
      }),
    );
  });

  it("throws 404 when group in operation not found", async () => {
    const { db, chain } = mockDb();
    // Pre-flight returns no matching groups
    chain.where.mockResolvedValueOnce([]);

    await expect(
      reorderGroups(
        db,
        SYSTEM_ID,
        { operations: [{ groupId: "grp_nonexistent", sortOrder: 0 }] },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 when one group in a multi-op batch does not exist", async () => {
    const { db, chain } = mockDb();
    // Pre-flight query returns only one of the two groups
    chain.where.mockResolvedValueOnce([{ id: GROUP_ID }]);

    await expect(
      reorderGroups(
        db,
        SYSTEM_ID,
        {
          operations: [
            { groupId: GROUP_ID, sortOrder: 1 },
            { groupId: "grp_nonexistent", sortOrder: 2 },
          ],
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "Group grp_nonexistent not found",
      }),
    );
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(reorderGroups(db, SYSTEM_ID, { operations: [] }, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
    );
  });
});

describe("archiveGroup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives a group", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: GROUP_ID }]);

    await archiveGroup(db, SYSTEM_ID, GROUP_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "group.archived" }),
    );
  });

  it("throws 404 when group not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveGroup(db, SYSTEM_ID, "grp_nonexistent" as GroupId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("restoreGroup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived group", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: GROUP_ID, parentGroupId: null }]) // archived group found
      .mockResolvedValueOnce([]); // no parent check needed (null parent)
    chain.returning.mockResolvedValueOnce([makeGroupRow({ version: 2 })]);

    const result = await restoreGroup(db, SYSTEM_ID, GROUP_ID, AUTH, mockAudit);

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "group.restored" }),
    );
  });

  it("throws 404 when archived group not found", async () => {
    const { db } = mockDb();

    await expect(
      restoreGroup(db, SYSTEM_ID, "grp_nonexistent" as GroupId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── copyGroup ────────────────────────────────────────────────────────

describe("copyGroup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("copies a group with default parent (same as source)", async () => {
    const { db, chain } = mockDb();
    // Inside transaction: source lookup, target parent lookup, max sort (terminal where), insert
    chain.limit
      .mockResolvedValueOnce([makeGroupRow({ parentGroupId: "grp_parent" })]) // source
      .mockResolvedValueOnce([{ id: "grp_parent" }]); // target parent
    // Max sort query has no .limit() — where() is terminal
    chain.where
      .mockReturnValueOnce(chain) // source group where
      .mockReturnValueOnce(chain) // target parent where
      .mockResolvedValueOnce([{ maxSort: 3 }]); // max sort where (terminal)
    chain.returning.mockResolvedValueOnce([
      makeGroupRow({ id: "grp_copy", parentGroupId: "grp_parent", sortOrder: 4 }),
    ]);

    const result = await copyGroup(db, SYSTEM_ID, GROUP_ID, {}, AUTH, mockAudit);

    expect(result.id).toBe("grp_copy");
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "group.created" }),
    );
  });

  it("copies a group to root when targetParentGroupId is null", async () => {
    const { db, chain } = mockDb();
    // Source lookup, no parent validation (null), max sort (terminal), insert
    chain.limit.mockResolvedValueOnce([makeGroupRow()]); // source
    chain.where
      .mockReturnValueOnce(chain) // source group where
      .mockResolvedValueOnce([{ maxSort: 5 }]); // max sort where (terminal)
    chain.returning.mockResolvedValueOnce([
      makeGroupRow({ id: "grp_root_copy", parentGroupId: null, sortOrder: 6 }),
    ]);

    const result = await copyGroup(
      db,
      SYSTEM_ID,
      GROUP_ID,
      { targetParentGroupId: null },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("grp_root_copy");
  });

  it("copies memberships when copyMemberships is true", async () => {
    const { db, chain } = mockDb();
    // Source lookup (null parent), no parent validation, max sort (terminal), insert, membership select (terminal)
    chain.limit.mockResolvedValueOnce([makeGroupRow()]); // source
    chain.where
      .mockReturnValueOnce(chain) // source group where
      .mockResolvedValueOnce([{ maxSort: 0 }]) // max sort where (terminal)
      .mockResolvedValueOnce([{ memberId: "mem_a" }, { memberId: "mem_b" }]); // membership select (terminal)
    chain.returning.mockResolvedValueOnce([makeGroupRow({ id: "grp_copy_m" })]);

    const result = await copyGroup(
      db,
      SYSTEM_ID,
      GROUP_ID,
      { copyMemberships: true },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("grp_copy_m");
    expect(chain.transaction).toHaveBeenCalledOnce();
  });

  it("does not copy memberships when copyMemberships is false", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeGroupRow()]); // source
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([{ maxSort: 0 }]);
    chain.returning.mockResolvedValueOnce([makeGroupRow({ id: "grp_no_copy" })]);

    const result = await copyGroup(
      db,
      SYSTEM_ID,
      GROUP_ID,
      { copyMemberships: false },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("grp_no_copy");
  });

  it("throws 404 when source group not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await expect(copyGroup(db, SYSTEM_ID, GROUP_ID, {}, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws 404 when target parent group not found", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([makeGroupRow()]) // source found
      .mockResolvedValueOnce([]); // target parent not found

    await expect(
      copyGroup(
        db,
        SYSTEM_ID,
        GROUP_ID,
        { targetParentGroupId: "grp_nonexistent" },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws VALIDATION_ERROR for invalid params", async () => {
    const { db } = mockDb();

    await expect(
      copyGroup(db, SYSTEM_ID, GROUP_ID, { copyMemberships: "yes" }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 404 for wrong system ownership (fail-closed privacy)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // ownership check returns no matching system
    const wrongAuth = { ...AUTH, systemId: "sys_other" as SystemId };

    await expect(copyGroup(db, SYSTEM_ID, GROUP_ID, {}, wrongAuth, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});
