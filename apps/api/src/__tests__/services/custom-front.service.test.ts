import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toCursor } from "../../lib/pagination.js";
import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { CustomFrontId, SystemId } from "@pluralscape/types";

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

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

// ── Import under test ────────────────────────────────────────────────

const { InvalidInputError } = await import("@pluralscape/crypto");
const { createCustomFront } = await import("../../services/custom-front/create.js");
const { listCustomFronts, getCustomFront } = await import(
  "../../services/custom-front/queries.js"
);
const { updateCustomFront } = await import("../../services/custom-front/update.js");
const { deleteCustomFront } = await import("../../services/custom-front/delete.js");
const { archiveCustomFront, restoreCustomFront } = await import(
  "../../services/custom-front/lifecycle.js"
);
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const CF_ID = brandId<CustomFrontId>("cf_test-custom-front");

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeCFRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: CF_ID,
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

describe("createCustomFront", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("creates a custom front successfully", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeCFRow()]);

    const result = await createCustomFront(
      db,
      SYSTEM_ID,
      { encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(CF_ID);
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "custom-front.created" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      createCustomFront(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(
      createCustomFront(db, SYSTEM_ID, { bad: "data" }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for oversized encryptedData", async () => {
    const { db } = mockDb();
    const oversized = Buffer.from(new Uint8Array(70_000)).toString("base64");

    await expect(
      createCustomFront(db, SYSTEM_ID, { encryptedData: oversized }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 400 for malformed blob", async () => {
    const { db } = mockDb();
    const { deserializeEncryptedBlob } = await import("@pluralscape/crypto");
    vi.mocked(deserializeEncryptedBlob).mockImplementationOnce(() => {
      throw new InvalidInputError("Invalid blob");
    });

    await expect(
      createCustomFront(db, SYSTEM_ID, { encryptedData: VALID_BLOB_BASE64 }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });
});

describe("listCustomFronts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty page when no custom fronts exist", async () => {
    const { db } = mockDb();

    const result = await listCustomFronts(db, SYSTEM_ID, AUTH);

    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it("returns custom fronts for system", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeCFRow()]);

    const result = await listCustomFronts(db, SYSTEM_ID, AUTH);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(CF_ID);
  });

  it("caps limit to MAX_CUSTOM_FRONT_LIMIT", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listCustomFronts(db, SYSTEM_ID, AUTH, undefined, 999);

    expect(chain.limit).toHaveBeenCalledWith(101);
  });

  it("applies cursor when provided", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    await listCustomFronts(db, SYSTEM_ID, AUTH, toCursor("cf_cursor-id"));

    expect(chain.where).toHaveBeenCalled();
  });
});

describe("getCustomFront", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns custom front for valid ID", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeCFRow()]);

    const result = await getCustomFront(db, SYSTEM_ID, CF_ID, AUTH);

    expect(result.id).toBe(CF_ID);
  });

  it("throws 404 when not found", async () => {
    const { db } = mockDb();

    await expect(
      getCustomFront(db, SYSTEM_ID, brandId<CustomFrontId>("cf_nonexistent"), AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("updateCustomFront", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("updates custom front with version increment", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([makeCFRow({ version: 2 })]);

    const result = await updateCustomFront(
      db,
      SYSTEM_ID,
      CF_ID,
      { encryptedData: VALID_BLOB_BASE64, version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "custom-front.updated" }),
    );
  });

  it("throws 409 on version conflict", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([{ id: CF_ID }]);

    await expect(
      updateCustomFront(
        db,
        SYSTEM_ID,
        CF_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("throws 404 when not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updateCustomFront(
        db,
        SYSTEM_ID,
        CF_ID,
        { encryptedData: VALID_BLOB_BASE64, version: 1 },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("deleteCustomFront", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("deletes custom front with no dependents", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: CF_ID }]);
    chain.where
      .mockReturnValueOnce(chain) // existence → .limit()
      .mockResolvedValueOnce([{ count: 0 }]); // session count

    await deleteCustomFront(db, SYSTEM_ID, CF_ID, AUTH, mockAudit);

    expect(chain.transaction).toHaveBeenCalled();
  });

  it("throws 404 when not found", async () => {
    const { db } = mockDb();

    await expect(
      deleteCustomFront(db, SYSTEM_ID, brandId<CustomFrontId>("cf_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 when has fronting sessions", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: CF_ID }]);
    chain.where
      .mockReturnValueOnce(chain) // existence → .limit()
      .mockResolvedValueOnce([{ count: 5 }]); // session count

    await expect(deleteCustomFront(db, SYSTEM_ID, CF_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({
        status: 409,
        code: "HAS_DEPENDENTS",
        message: expect.stringContaining("5 fronting session(s)"),
      }),
    );
  });
});

describe("archiveCustomFront", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives a custom front", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: CF_ID }]);

    await archiveCustomFront(db, SYSTEM_ID, CF_ID, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "custom-front.archived" }),
    );
  });

  it("throws 404 when not found", async () => {
    const { db } = mockDb();

    await expect(
      archiveCustomFront(db, SYSTEM_ID, brandId<CustomFrontId>("cf_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("restoreCustomFront", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("restores an archived custom front", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: CF_ID }]);
    chain.returning.mockResolvedValueOnce([makeCFRow({ version: 2 })]);

    const result = await restoreCustomFront(db, SYSTEM_ID, CF_ID, AUTH, mockAudit);

    expect(result.version).toBe(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "custom-front.restored" }),
    );
  });

  it("throws 404 when archived custom front not found", async () => {
    const { db } = mockDb();

    await expect(
      restoreCustomFront(db, SYSTEM_ID, brandId<CustomFrontId>("cf_nonexistent"), AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
