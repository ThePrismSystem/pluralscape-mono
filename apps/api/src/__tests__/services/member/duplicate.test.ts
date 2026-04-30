/**
 * Unit tests for member/create.ts — duplicateMember.
 */
import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";

import { AUTH, MEMBER_ID, SYSTEM_ID, VALID_BLOB_BASE64, makeMemberRow } from "./internal.js";

import type { MemberId } from "@pluralscape/types";

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

const { duplicateMember } = await import("../../../services/member/create.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

// ── Tests ────────────────────────────────────────────────────────────

describe("duplicateMember", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("duplicates a member successfully", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);
    const newRow = makeMemberRow({ id: "mem_new-member" });
    chain.returning.mockResolvedValueOnce([newRow]);

    const result = await duplicateMember(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      {
        encryptedData: VALID_BLOB_BASE64,
        copyPhotos: false,
        copyFields: false,
        copyMemberships: false,
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_new-member");
    expect(chain.transaction).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "member.duplicated" }),
    );
  });

  it("throws 404 when source member not found", async () => {
    const { db } = mockDb();
    await expect(
      duplicateMember(
        db,
        SYSTEM_ID,
        brandId<MemberId>("mem_nonexistent"),
        {
          encryptedData: VALID_BLOB_BASE64,
          copyPhotos: false,
          copyFields: false,
          copyMemberships: false,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("copies photos when copyPhotos is true", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);
    const newRow = makeMemberRow({ id: "mem_new-member" });
    chain.returning.mockResolvedValueOnce([newRow]);
    chain.where
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce([
        {
          id: "mphoto_existing",
          memberId: MEMBER_ID,
          systemId: SYSTEM_ID,
          sortOrder: 0,
          encryptedData: new Uint8Array([4, 5, 6]),
          archived: false,
        },
      ]);
    chain.returning.mockResolvedValueOnce([{ id: "mphoto_new" }]);

    const result = await duplicateMember(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      {
        encryptedData: VALID_BLOB_BASE64,
        copyPhotos: true,
        copyFields: false,
        copyMemberships: false,
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_new-member");
    expect(chain.insert).toHaveBeenCalledTimes(2);
  });

  it("copies field values when copyFields is true", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);
    const newRow = makeMemberRow({ id: "mem_new-member" });
    chain.returning.mockResolvedValueOnce([newRow]);
    chain.where
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce([
        {
          id: "fval_existing",
          fieldDefinitionId: "fdef_test",
          memberId: MEMBER_ID,
          systemId: SYSTEM_ID,
          encryptedData: new Uint8Array([7, 8, 9]),
        },
      ]);
    chain.returning.mockResolvedValueOnce([{ id: "fval_new" }]);

    const result = await duplicateMember(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      {
        encryptedData: VALID_BLOB_BASE64,
        copyPhotos: false,
        copyFields: true,
        copyMemberships: false,
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_new-member");
    expect(chain.insert).toHaveBeenCalledTimes(2);
  });

  it("copies group memberships when copyMemberships is true", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);
    const newRow = makeMemberRow({ id: "mem_new-member" });
    chain.returning.mockResolvedValueOnce([newRow]);
    chain.where
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce([
        { groupId: "grp_group-1", memberId: MEMBER_ID, systemId: SYSTEM_ID, createdAt: 1000 },
        { groupId: "grp_group-2", memberId: MEMBER_ID, systemId: SYSTEM_ID, createdAt: 1000 },
      ]);
    chain.returning.mockResolvedValueOnce([{ groupId: "grp_group-1" }, { groupId: "grp_group-2" }]);

    const result = await duplicateMember(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      {
        encryptedData: VALID_BLOB_BASE64,
        copyPhotos: false,
        copyFields: false,
        copyMemberships: true,
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_new-member");
    expect(chain.insert).toHaveBeenCalledTimes(2);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({
        eventType: "member.duplicated",
        detail: expect.stringContaining("2 membership(s) copied"),
      }),
    );
  });

  it("skips membership copy when source has no memberships", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([makeMemberRow()]);
    const newRow = makeMemberRow({ id: "mem_new-member" });
    chain.returning.mockResolvedValueOnce([newRow]);
    chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([]);

    const result = await duplicateMember(
      db,
      SYSTEM_ID,
      MEMBER_ID,
      {
        encryptedData: VALID_BLOB_BASE64,
        copyPhotos: false,
        copyFields: false,
        copyMemberships: true,
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe("mem_new-member");
    expect(chain.insert).toHaveBeenCalledTimes(1);
  });
});
