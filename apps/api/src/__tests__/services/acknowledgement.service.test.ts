import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { ArchivableEntityConfig, DeletableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { EncryptedBase64, AcknowledgementId, MemberId, SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

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

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/entity-lifecycle.js", () => ({
  archiveEntity: vi.fn().mockResolvedValue(undefined),
  deleteEntity: vi.fn().mockResolvedValue(undefined),
  restoreEntity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

vi.mock("@pluralscape/db/pg", () => ({
  acknowledgements: {
    id: "id",
    systemId: "system_id",
    createdByMemberId: "created_by_member_id",
    confirmed: "confirmed",
    encryptedData: "encrypted_data" as EncryptedBase64,
    version: "version",
    archived: "archived",
    archivedAt: "archived_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("ak_test-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    lt: vi.fn((a: unknown, b: unknown) => ["lt", a, b]),
    or: vi.fn((...args: unknown[]) => args),
    desc: vi.fn((a: unknown) => ["desc", a]),
    sql: Object.assign(vi.fn(), { join: vi.fn() }),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { archiveEntity, deleteEntity, restoreEntity } =
  await import("../../lib/entity-lifecycle.js");

const { createAcknowledgement } = await import("../../services/acknowledgement/create.js");
const { confirmAcknowledgement } = await import("../../services/acknowledgement/confirm.js");
const { getAcknowledgement, listAcknowledgements } =
  await import("../../services/acknowledgement/queries.js");
const { deleteAcknowledgement, archiveAcknowledgement, restoreAcknowledgement } =
  await import("../../services/acknowledgement/lifecycle.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const ACK_ID = brandId<AcknowledgementId>("ak_test-ack");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeAckRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ACK_ID,
    systemId: SYSTEM_ID,
    createdByMemberId: null,
    confirmed: false,
    encryptedData: new Uint8Array([1, 2, 3]),
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("acknowledgement service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── createAcknowledgement ──────────────────────────────────────

  describe("createAcknowledgement", () => {
    const validPayload = { encryptedData: VALID_BLOB_BASE64, createdByMemberId: undefined };

    it("creates an acknowledgement and returns result", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makeAckRow()]);

      const result = await createAcknowledgement(db, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(ACK_ID);
      expect(result.confirmed).toBe(false);
      expect(chain.transaction).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "acknowledgement.created" }),
      );
    });

    it("creates acknowledgement with createdByMemberId when provided", async () => {
      const { db, chain } = mockDb();
      const memberId = brandId<MemberId>("mem_00000000-0000-4000-a000-000000000001");
      chain.returning.mockResolvedValueOnce([makeAckRow({ createdByMemberId: memberId })]);

      const result = await createAcknowledgement(
        db,
        SYSTEM_ID,
        {
          encryptedData: VALID_BLOB_BASE64,
          createdByMemberId: memberId,
        },
        AUTH,
        mockAudit,
      );

      expect(result.createdByMemberId).toBe("mem_00000000-0000-4000-a000-000000000001");
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        createAcknowledgement(db, SYSTEM_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── confirmAcknowledgement ─────────────────────────────────────

  describe("confirmAcknowledgement", () => {
    /**
     * The confirmAcknowledgement service uses .limit(1).for("update").
     * In the mock chain, .limit() returns a Promise, so .for() must be
     * set up on the chain to resolve the result directly.
     * We override .limit to return the chain (not resolve) and .for to resolve the data.
     */
    function mockForUpdateFetch(
      chain: ReturnType<typeof mockDb>["chain"],
      result: Record<string, unknown>[],
    ): void {
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce(result);
    }

    it("confirms an unconfirmed acknowledgement", async () => {
      const { db, chain } = mockDb();
      mockForUpdateFetch(chain, [makeAckRow({ confirmed: false })]);
      chain.returning.mockResolvedValueOnce([makeAckRow({ confirmed: true, version: 2 })]);

      const result = await confirmAcknowledgement(db, SYSTEM_ID, ACK_ID, {}, AUTH, mockAudit);

      expect(result.confirmed).toBe(true);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "acknowledgement.confirmed" }),
      );
    });

    it("returns current state idempotently when already confirmed", async () => {
      const { db, chain } = mockDb();
      mockForUpdateFetch(chain, [makeAckRow({ confirmed: true })]);

      const result = await confirmAcknowledgement(db, SYSTEM_ID, ACK_ID, {}, AUTH, mockAudit);

      expect(result.confirmed).toBe(true);
      // No update or audit for idempotent re-confirm
      expect(mockAudit).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when acknowledgement does not exist", async () => {
      const { db, chain } = mockDb();
      mockForUpdateFetch(chain, []); // not found

      await expect(
        confirmAcknowledgement(db, SYSTEM_ID, ACK_ID, {}, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("updates encryptedData when provided in confirm payload", async () => {
      const { db, chain } = mockDb();
      mockForUpdateFetch(chain, [makeAckRow({ confirmed: false })]);
      chain.returning.mockResolvedValueOnce([makeAckRow({ confirmed: true })]);

      await confirmAcknowledgement(
        db,
        SYSTEM_ID,
        ACK_ID,
        { encryptedData: VALID_BLOB_BASE64 },
        AUTH,
        mockAudit,
      );

      expect(chain.returning).toHaveBeenCalled();
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        confirmAcknowledgement(db, SYSTEM_ID, ACK_ID, {}, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── getAcknowledgement ─────────────────────────────────────────

  describe("getAcknowledgement", () => {
    it("returns acknowledgement when found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeAckRow()]);

      const result = await getAcknowledgement(db, SYSTEM_ID, ACK_ID, AUTH);

      expect(result.id).toBe(ACK_ID);
      expect(result.confirmed).toBe(false);
    });

    it("throws 404 when acknowledgement not found", async () => {
      const { db } = mockDb();

      await expect(getAcknowledgement(db, SYSTEM_ID, ACK_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(getAcknowledgement(db, SYSTEM_ID, ACK_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── listAcknowledgements ───────────────────────────────────────

  describe("listAcknowledgements", () => {
    it("returns paginated acknowledgements", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeAckRow()]);

      const result = await listAcknowledgements(db, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it("returns empty list when no acknowledgements exist", async () => {
      const { db } = mockDb();

      const result = await listAcknowledgements(db, SYSTEM_ID, AUTH);

      expect(result.data).toEqual([]);
    });

    it("filters by confirmed status when provided", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makeAckRow({ confirmed: true })]);

      const result = await listAcknowledgements(db, SYSTEM_ID, AUTH, { confirmed: true });

      expect(result.data[0]?.confirmed).toBe(true);
    });

    it("detects hasMore when more rows exist than limit", async () => {
      const { db, chain } = mockDb();
      const rows = [makeAckRow({ id: "ak_a" }), makeAckRow({ id: "ak_b" })];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listAcknowledgements(db, SYSTEM_ID, AUTH, { limit: 1 });

      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  // ── deleteAcknowledgement ──────────────────────────────────────

  describe("deleteAcknowledgement", () => {
    it("delegates to deleteEntity with correct config", async () => {
      const { db } = mockDb();
      vi.mocked(deleteEntity).mockResolvedValueOnce(undefined);

      await deleteAcknowledgement(db, SYSTEM_ID, ACK_ID, AUTH, mockAudit);

      expect(deleteEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        ACK_ID,
        AUTH,
        mockAudit,
        expect.objectContaining<Partial<DeletableEntityConfig<string>>>({
          entityName: "Acknowledgement",
          deleteEvent: "acknowledgement.deleted",
        }),
      );
    });
  });

  // ── archiveAcknowledgement ─────────────────────────────────────

  describe("archiveAcknowledgement", () => {
    it("delegates to archiveEntity with correct config", async () => {
      const { db } = mockDb();
      vi.mocked(archiveEntity).mockResolvedValueOnce(undefined);

      await archiveAcknowledgement(db, SYSTEM_ID, ACK_ID, AUTH, mockAudit);

      expect(archiveEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        ACK_ID,
        AUTH,
        mockAudit,
        expect.objectContaining<Partial<ArchivableEntityConfig<string>>>({
          entityName: "Acknowledgement",
          archiveEvent: "acknowledgement.archived",
          restoreEvent: "acknowledgement.restored",
        }),
      );
    });
  });

  // ── restoreAcknowledgement ─────────────────────────────────────

  describe("restoreAcknowledgement", () => {
    it("delegates to restoreEntity and maps the row", async () => {
      const { db } = mockDb();
      const row = makeAckRow({ version: 3, confirmed: true });

      vi.mocked(restoreEntity).mockImplementationOnce(
        async (_db, _sId, _eid, _auth, _audit, _cfg, toResult) => Promise.resolve(toResult(row)),
      );

      const result = await restoreAcknowledgement(db, SYSTEM_ID, ACK_ID, AUTH, mockAudit);

      expect(result.id).toBe(ACK_ID);
      expect(result.version).toBe(3);
      expect(result.confirmed).toBe(true);
    });
  });
});
