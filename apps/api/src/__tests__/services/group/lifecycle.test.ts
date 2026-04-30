import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";

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

const { deleteGroup, archiveGroup, restoreGroup } =
  await import("../../../services/group/lifecycle.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

// ── Tests ────────────────────────────────────────────────────────────

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
      .mockResolvedValueOnce([{ count: 0 }]) // memberships count
      .mockResolvedValueOnce([{ count: 0 }]); // field values count

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
      deleteGroup(db, SYSTEM_ID, brandId<GroupId>("grp_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 when group has dependents", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: GROUP_ID }]);
    chain.where
      .mockReturnValueOnce(chain) // existence → .limit()
      .mockResolvedValueOnce([{ count: 2 }]) // child groups
      .mockResolvedValueOnce([{ count: 3 }]) // memberships
      .mockResolvedValueOnce([{ count: 0 }]); // field values

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
    let resolve3!: (v: { count: number }[]) => void;

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
      )
      .mockReturnValueOnce(
        new Promise<{ count: number }[]>((r) => {
          resolve3 = r;
        }),
      );

    // Start deleteGroup without awaiting — sequential impl would deadlock here
    const done = deleteGroup(db, SYSTEM_ID, GROUP_ID, AUTH, mockAudit);

    // Flush microtasks so RLS context set + existence check resolves and dependent queries dispatch
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });

    // All dependent-check .where() calls dispatched before any resolved
    expect(chain.where).toHaveBeenCalledTimes(4); // 1 existence + 3 dependents

    resolve1([{ count: 0 }]);
    resolve2([{ count: 0 }]);
    resolve3([{ count: 0 }]);
    await done;

    expect(chain.select).toHaveBeenCalledTimes(4);
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
      archiveGroup(db, SYSTEM_ID, brandId<GroupId>("grp_nonexistent"), AUTH, mockAudit),
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
      restoreGroup(db, SYSTEM_ID, brandId<GroupId>("grp_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
