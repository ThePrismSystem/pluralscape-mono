import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toCursor } from "../../../lib/pagination.js";
import { mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";

import { AUTH, GROUP_ID, SYSTEM_ID, VALID_BLOB_BASE64, makeGroupRow } from "./internal.js";

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

const { InvalidInputError } = await import("@pluralscape/crypto");
const { createGroup } = await import("../../../services/group/create.js");
const { updateGroup } = await import("../../../services/group/update.js");
const { listGroups, getGroup } = await import("../../../services/group/queries.js");
const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

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
        {
          encryptedData: VALID_BLOB_BASE64,
          parentGroupId: brandId<GroupId>("grp_nonexistent"),
          sortOrder: 0,
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
      createGroup(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, parentGroupId: null, sortOrder: 0 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
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
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "BLOB_TOO_LARGE" }));
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

  it("throws QUOTA_EXCEEDED when group count is at maximum", async () => {
    const { db, chain } = mockDb();
    chain.where
      .mockReturnValueOnce(chain) // quota FOR UPDATE lock -> chains to .for()
      .mockResolvedValueOnce([{ count: 200 }]); // quota count -> at limit

    await expect(
      createGroup(
        db,
        SYSTEM_ID,
        { encryptedData: VALID_BLOB_BASE64, parentGroupId: null, sortOrder: 0 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 429, code: "QUOTA_EXCEEDED" }));
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

    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("returns groups for system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeGroupRow()]);

    const result = await listGroups(db, SYSTEM_ID, AUTH);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(GROUP_ID);
  });

  it("detects hasMore when more rows than limit", async () => {
    const { db, chain } = mockDb();
    const rows = [makeGroupRow({ id: "grp_a" }), makeGroupRow({ id: "grp_b" })];
    chain.limit.mockResolvedValueOnce(rows);

    const result = await listGroups(db, SYSTEM_ID, AUTH, undefined, 1);

    expect(result.data).toHaveLength(1);
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

    await expect(
      getGroup(db, SYSTEM_ID, brandId<GroupId>("grp_nonexistent"), AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
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
});
