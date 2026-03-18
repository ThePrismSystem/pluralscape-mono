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
  addSubsystemMembership,
  removeSubsystemMembership,
  listSubsystemMemberships,
  addSideSystemMembership,
  removeSideSystemMembership,
  listSideSystemMemberships,
  addLayerMembership,
  removeLayerMembership,
  listLayerMemberships,
} = await import("../../services/structure-membership.service.js");
const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const SUBSYSTEM_ID = "sub_test";
const SIDE_SYSTEM_ID = "ssys_test";
const LAYER_ID = "lyr_test";
const MEMBER_ID = "mem_test";
const MEMBERSHIP_ID = "subm_test";

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

const VALID_PARAMS = { memberId: MEMBER_ID, encryptedData: VALID_BLOB_BASE64 };

function makeSubsystemMembershipRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: MEMBERSHIP_ID,
    subsystemId: SUBSYSTEM_ID,
    memberId: MEMBER_ID,
    systemId: SYSTEM_ID,
    encryptedData: new Uint8Array([1, 2, 3]),
    createdAt: 1000,
    ...overrides,
  };
}

function makeSideSystemMembershipRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "ssysm_test",
    sideSystemId: SIDE_SYSTEM_ID,
    memberId: MEMBER_ID,
    systemId: SYSTEM_ID,
    encryptedData: new Uint8Array([1, 2, 3]),
    createdAt: 1000,
    ...overrides,
  };
}

function makeLayerMembershipRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "lyrm_test",
    layerId: LAYER_ID,
    memberId: MEMBER_ID,
    systemId: SYSTEM_ID,
    encryptedData: new Uint8Array([1, 2, 3]),
    createdAt: 1000,
    ...overrides,
  };
}

// ── SUBSYSTEM MEMBERSHIPS ────────────────────────────────────────────

describe("addSubsystemMembership", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("adds a membership and writes audit log", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]) // entity exists
      .mockResolvedValueOnce([{ id: MEMBER_ID }]); // member exists
    chain.returning.mockResolvedValueOnce([makeSubsystemMembershipRow()]);

    const result = await addSubsystemMembership(
      db,
      SYSTEM_ID,
      SUBSYSTEM_ID,
      VALID_PARAMS,
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(MEMBERSHIP_ID);
    expect(result.entityId).toBe(SUBSYSTEM_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(result.encryptedData).toBeDefined();
    expect(result.createdAt).toBe(1000);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "subsystem-membership.added" }),
    );
  });

  it("throws 404 for system ownership failure", async () => {
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));
    const { db } = mockDb();

    await expect(
      addSubsystemMembership(db, SYSTEM_ID, SUBSYSTEM_ID, VALID_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 400 for invalid body", async () => {
    const { db } = mockDb();

    await expect(
      addSubsystemMembership(db, SYSTEM_ID, SUBSYSTEM_ID, {}, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws 404 when subsystem not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // entity not found

    await expect(
      addSubsystemMembership(db, SYSTEM_ID, SUBSYSTEM_ID, VALID_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 when member not found", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]) // entity found
      .mockResolvedValueOnce([]); // member not found

    await expect(
      addSubsystemMembership(db, SYSTEM_ID, SUBSYSTEM_ID, VALID_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 409 on unique constraint violation (duplicate membership)", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]) // entity found
      .mockResolvedValueOnce([{ id: MEMBER_ID }]); // member found
    const dbError = Object.assign(new Error("unique_violation"), { code: PG_UNIQUE_VIOLATION });
    chain.returning.mockRejectedValueOnce(dbError);

    await expect(
      addSubsystemMembership(db, SYSTEM_ID, SUBSYSTEM_ID, VALID_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });

  it("re-throws non-constraint DB errors", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SUBSYSTEM_ID }])
      .mockResolvedValueOnce([{ id: MEMBER_ID }]);
    chain.returning.mockRejectedValueOnce(new Error("connection lost"));

    await expect(
      addSubsystemMembership(db, SYSTEM_ID, SUBSYSTEM_ID, VALID_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow("connection lost");
  });
});

describe("removeSubsystemMembership", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("removes a membership and writes audit log", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: MEMBERSHIP_ID }]);

    await removeSubsystemMembership(db, SYSTEM_ID, MEMBERSHIP_ID, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "subsystem-membership.removed" }),
    );
  });

  it("throws 404 when membership not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      removeSubsystemMembership(db, SYSTEM_ID, MEMBERSHIP_ID, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("listSubsystemMemberships", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns memberships for subsystem", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SUBSYSTEM_ID }]) // entity exists
      .mockResolvedValueOnce([makeSubsystemMembershipRow()]); // membership rows

    const result = await listSubsystemMemberships(db, SYSTEM_ID, SUBSYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.entityId).toBe(SUBSYSTEM_ID);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.totalCount).toBeNull();
  });

  it("throws 404 when subsystem not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // entity not found

    await expect(listSubsystemMemberships(db, SYSTEM_ID, SUBSYSTEM_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

// ── SIDE SYSTEM MEMBERSHIPS ──────────────────────────────────────────

describe("addSideSystemMembership", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("adds a side system membership and writes audit log", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SIDE_SYSTEM_ID }]) // entity exists
      .mockResolvedValueOnce([{ id: MEMBER_ID }]); // member exists
    chain.returning.mockResolvedValueOnce([makeSideSystemMembershipRow()]);

    const result = await addSideSystemMembership(
      db,
      SYSTEM_ID,
      SIDE_SYSTEM_ID,
      VALID_PARAMS,
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("ssysm_test");
    expect(result.entityId).toBe(SIDE_SYSTEM_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "side-system-membership.added" }),
    );
  });

  it("throws 409 on duplicate side system membership", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SIDE_SYSTEM_ID }])
      .mockResolvedValueOnce([{ id: MEMBER_ID }]);
    const dbError = Object.assign(new Error("unique_violation"), { code: PG_UNIQUE_VIOLATION });
    chain.returning.mockRejectedValueOnce(dbError);

    await expect(
      addSideSystemMembership(db, SYSTEM_ID, SIDE_SYSTEM_ID, VALID_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });
});

describe("removeSideSystemMembership", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("removes a side system membership and writes audit log", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: "ssysm_test" }]);

    await removeSideSystemMembership(db, SYSTEM_ID, "ssysm_test", AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "side-system-membership.removed" }),
    );
  });

  it("throws 404 when side system membership not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      removeSideSystemMembership(db, SYSTEM_ID, "ssysm_nonexistent", AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("listSideSystemMemberships", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns memberships for side system", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: SIDE_SYSTEM_ID }]) // entity exists
      .mockResolvedValueOnce([makeSideSystemMembershipRow()]); // membership rows

    const result = await listSideSystemMemberships(db, SYSTEM_ID, SIDE_SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.entityId).toBe(SIDE_SYSTEM_ID);
    expect(result.hasMore).toBe(false);
  });

  it("throws 404 when side system not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // entity not found

    await expect(
      listSideSystemMemberships(db, SYSTEM_ID, "ssys_nonexistent", AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── LAYER MEMBERSHIPS ────────────────────────────────────────────────

describe("addLayerMembership", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("adds a layer membership and writes audit log", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: LAYER_ID }]) // entity exists
      .mockResolvedValueOnce([{ id: MEMBER_ID }]); // member exists
    chain.returning.mockResolvedValueOnce([makeLayerMembershipRow()]);

    const result = await addLayerMembership(db, SYSTEM_ID, LAYER_ID, VALID_PARAMS, AUTH, mockAudit);

    expect(result.id).toBe("lyrm_test");
    expect(result.entityId).toBe(LAYER_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "layer-membership.added" }),
    );
  });

  it("throws 409 on duplicate layer membership", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: LAYER_ID }])
      .mockResolvedValueOnce([{ id: MEMBER_ID }]);
    const dbError = Object.assign(new Error("unique_violation"), { code: PG_UNIQUE_VIOLATION });
    chain.returning.mockRejectedValueOnce(dbError);

    await expect(
      addLayerMembership(db, SYSTEM_ID, LAYER_ID, VALID_PARAMS, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
  });
});

describe("removeLayerMembership", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("removes a layer membership and writes audit log", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([{ id: "lyrm_test" }]);

    await removeLayerMembership(db, SYSTEM_ID, "lyrm_test", AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: "layer-membership.removed" }),
    );
  });

  it("throws 404 when layer membership not found", async () => {
    const { db, chain } = mockDb();
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      removeLayerMembership(db, SYSTEM_ID, "lyrm_nonexistent", AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

describe("listLayerMemberships", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns memberships for layer", async () => {
    const { db, chain } = mockDb();
    chain.limit
      .mockResolvedValueOnce([{ id: LAYER_ID }]) // entity exists
      .mockResolvedValueOnce([makeLayerMembershipRow()]); // membership rows

    const result = await listLayerMemberships(db, SYSTEM_ID, LAYER_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.entityId).toBe(LAYER_ID);
    expect(result.hasMore).toBe(false);
  });

  it("throws 404 when layer not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]); // entity not found

    await expect(listLayerMemberships(db, SYSTEM_ID, "lyr_nonexistent", AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});
