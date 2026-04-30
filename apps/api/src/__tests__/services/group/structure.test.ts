import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";
import { makeTestAuth } from "../../helpers/test-auth.js";

import { AUTH, GROUP_ID, SYSTEM_ID, makeGroupRow } from "./internal.js";

import type { GroupId } from "@pluralscape/types";

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

vi.mock("../../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

// ── Import under test ────────────────────────────────────────────────

const { getGroupTree } = await import("../../../services/group/queries.js");
const { moveGroup, reorderGroups, copyGroup } =
  await import("../../../services/group/structure.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

// ── Tests ────────────────────────────────────────────────────────────

describe("moveGroup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("moves group to new parent", async () => {
    const { db, chain } = mockDb();
    const parentId = brandId<GroupId>("grp_parent");
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
        { targetParentGroupId: brandId<GroupId>("grp_nonexistent"), version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 on circular reference", async () => {
    const { db, chain } = mockDb();
    const childId = brandId<GroupId>("grp_child");
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
      expect.objectContaining({ eventType: "group.updated", detail: "Reordered 1 group(s)" }),
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
        { operations: [{ groupId: brandId<GroupId>("grp_nonexistent"), sortOrder: 0 }] },
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
            { groupId: brandId<GroupId>("grp_nonexistent"), sortOrder: 2 },
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
});

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

    const result = await copyGroup(
      db,
      SYSTEM_ID,
      GROUP_ID,
      { copyMemberships: false },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("grp_copy");
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "group.created" }),
    );
  });

  it("copies a group to root when targetParentGroupId is null", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeGroupRow()]); // source
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([{ maxSort: 5 }]);
    chain.returning.mockResolvedValueOnce([
      makeGroupRow({ id: "grp_root_copy", parentGroupId: null, sortOrder: 6 }),
    ]);

    const result = await copyGroup(
      db,
      SYSTEM_ID,
      GROUP_ID,
      { targetParentGroupId: null, copyMemberships: false },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("grp_root_copy");
  });

  it("copies memberships when copyMemberships is true", async () => {
    const { db, chain } = mockDb();
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

    await expect(
      copyGroup(db, SYSTEM_ID, GROUP_ID, { copyMemberships: false }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
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
        { targetParentGroupId: brandId<GroupId>("grp_nonexistent"), copyMemberships: false },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 for wrong system ownership (fail-closed privacy)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // ownership check returns no matching system
    const wrongAuth = makeTestAuth({
      accountId: "acct_test-account",
      systemId: "sys_other",
      sessionId: "sess_test-session",
    });

    await expect(
      copyGroup(db, SYSTEM_ID, GROUP_ID, { copyMemberships: false }, wrongAuth, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
