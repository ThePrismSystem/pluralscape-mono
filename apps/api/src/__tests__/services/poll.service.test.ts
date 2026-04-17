import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { ArchivableEntityConfig, DeletableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { PollId, SystemId } from "@pluralscape/types";

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
  polls: {
    id: "id",
    systemId: "system_id",
    createdByMemberId: "created_by_member_id",
    kind: "kind",
    status: "status",
    closedAt: "closed_at",
    endsAt: "ends_at",
    allowMultipleVotes: "allow_multiple_votes",
    maxVotesPerMember: "max_votes_per_member",
    allowAbstain: "allow_abstain",
    allowVeto: "allow_veto",
    encryptedData: "encrypted_data",
    version: "version",
    archived: "archived",
    archivedAt: "archived_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  pollVotes: {
    id: "id",
    systemId: "system_id",
    pollId: "poll_id",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("pl_test-id"),
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
    count: vi.fn(() => ({ count: "count" })),
    desc: vi.fn((a: unknown) => ["desc", a]),
    sql: Object.assign(vi.fn(), { join: vi.fn() }),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { archiveEntity, deleteEntity, restoreEntity } =
  await import("../../lib/entity-lifecycle.js");

const {
  createPoll,
  getPoll,
  listPolls,
  updatePoll,
  closePoll,
  deletePoll,
  archivePoll,
  restorePoll,
} = await import("../../services/poll.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const POLL_ID = brandId<PollId>("pl_test-poll");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makePollRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: POLL_ID,
    systemId: SYSTEM_ID,
    createdByMemberId: null,
    kind: "standard",
    status: "open",
    closedAt: null,
    endsAt: null,
    allowMultipleVotes: false,
    maxVotesPerMember: 1,
    allowAbstain: false,
    allowVeto: false,
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

describe("poll service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── createPoll ─────────────────────────────────────────────────

  describe("createPoll", () => {
    const validPayload = {
      encryptedData: VALID_BLOB_BASE64,
      kind: "standard",
      allowMultipleVotes: false,
      maxVotesPerMember: 1,
      allowAbstain: false,
      allowVeto: false,
    };

    it("creates a poll and returns result", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makePollRow()]);

      const result = await createPoll(db, SYSTEM_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(POLL_ID);
      expect(result.status).toBe("open");
      expect(chain.transaction).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "poll.created" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();

      await expect(createPoll(db, SYSTEM_ID, { bad: true }, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
      );
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(createPoll(db, SYSTEM_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── getPoll ────────────────────────────────────────────────────

  describe("getPoll", () => {
    it("returns poll when found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makePollRow()]);

      const result = await getPoll(db, SYSTEM_ID, POLL_ID, AUTH);

      expect(result.id).toBe(POLL_ID);
      expect(result.status).toBe("open");
    });

    it("throws 404 when poll not found", async () => {
      const { db } = mockDb();

      await expect(getPoll(db, SYSTEM_ID, POLL_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(getPoll(db, SYSTEM_ID, POLL_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── listPolls ──────────────────────────────────────────────────

  describe("listPolls", () => {
    it("returns paginated polls", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makePollRow()]);

      const result = await listPolls(db, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it("returns empty list when no polls exist", async () => {
      const { db } = mockDb();

      const result = await listPolls(db, SYSTEM_ID, AUTH);

      expect(result.data).toEqual([]);
    });

    it("applies status filter when provided", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([makePollRow({ status: "closed" })]);

      const result = await listPolls(db, SYSTEM_ID, AUTH, { status: "closed" });

      expect(result.data[0]?.status).toBe("closed");
    });

    it("detects hasMore when more rows exist than limit", async () => {
      const { db, chain } = mockDb();
      const rows = [makePollRow({ id: "pl_a" }), makePollRow({ id: "pl_b" })];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listPolls(db, SYSTEM_ID, AUTH, { limit: 1 });

      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  // ── updatePoll ─────────────────────────────────────────────────

  describe("updatePoll", () => {
    const validUpdate = { encryptedData: VALID_BLOB_BASE64, version: 1 };

    it("updates poll and returns result", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makePollRow({ version: 2 })]);

      const result = await updatePoll(db, SYSTEM_ID, POLL_ID, validUpdate, AUTH, mockAudit);

      expect(result.version).toBe(2);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "poll.updated" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();

      await expect(
        updatePoll(db, SYSTEM_ID, POLL_ID, { bad: true }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("throws POLL_CLOSED when poll is closed", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ id: POLL_ID, status: "closed", archived: false }]);

      await expect(
        updatePoll(db, SYSTEM_ID, POLL_ID, validUpdate, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "POLL_CLOSED" }));
    });

    it("throws CONFLICT on version mismatch when poll is open", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ id: POLL_ID, status: "open", archived: false }]);

      await expect(
        updatePoll(db, SYSTEM_ID, POLL_ID, validUpdate, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("throws NOT_FOUND when poll does not exist", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        updatePoll(db, SYSTEM_ID, POLL_ID, validUpdate, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── closePoll ──────────────────────────────────────────────────

  describe("closePoll", () => {
    it("closes an open poll", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([makePollRow({ status: "closed", closedAt: 1000 })]);

      const result = await closePoll(db, SYSTEM_ID, POLL_ID, AUTH, mockAudit);

      expect(result.status).toBe("closed");
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "poll.closed" }),
      );
    });

    it("throws POLL_CLOSED when poll is already closed", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ id: POLL_ID, status: "closed", archived: false }]);

      await expect(closePoll(db, SYSTEM_ID, POLL_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "POLL_CLOSED" }),
      );
    });

    it("throws NOT_FOUND when poll does not exist", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([]);

      await expect(closePoll(db, SYSTEM_ID, POLL_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws NOT_FOUND when poll is archived", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);
      chain.limit.mockResolvedValueOnce([{ id: POLL_ID, status: "open", archived: true }]);

      await expect(closePoll(db, SYSTEM_ID, POLL_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── deletePoll ─────────────────────────────────────────────────

  describe("deletePoll", () => {
    it("delegates to deleteEntity with correct config", async () => {
      const { db } = mockDb();
      vi.mocked(deleteEntity).mockResolvedValueOnce(undefined);

      await deletePoll(db, SYSTEM_ID, POLL_ID, AUTH, mockAudit);

      expect(deleteEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        POLL_ID,
        AUTH,
        mockAudit,
        expect.objectContaining<Partial<DeletableEntityConfig<string>>>({
          entityName: "Poll",
          deleteEvent: "poll.deleted",
        }),
      );
    });
  });

  // ── archivePoll ────────────────────────────────────────────────

  describe("archivePoll", () => {
    it("delegates to archiveEntity with correct config", async () => {
      const { db } = mockDb();
      vi.mocked(archiveEntity).mockResolvedValueOnce(undefined);

      await archivePoll(db, SYSTEM_ID, POLL_ID, AUTH, mockAudit);

      expect(archiveEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        POLL_ID,
        AUTH,
        mockAudit,
        expect.objectContaining<Partial<ArchivableEntityConfig<string>>>({
          entityName: "Poll",
          archiveEvent: "poll.archived",
          restoreEvent: "poll.restored",
        }),
      );
    });
  });

  // ── restorePoll ────────────────────────────────────────────────

  describe("restorePoll", () => {
    it("delegates to restoreEntity and maps the row", async () => {
      const { db } = mockDb();
      const row = makePollRow({ version: 4, status: "closed" });

      vi.mocked(restoreEntity).mockImplementationOnce(
        async (_db, _sId, _eid, _auth, _audit, _cfg, toResult) => Promise.resolve(toResult(row)),
      );

      const result = await restorePoll(db, SYSTEM_ID, POLL_ID, AUTH, mockAudit);

      expect(result.id).toBe(POLL_ID);
      expect(result.version).toBe(4);
      expect(result.status).toBe("closed");
    });
  });
});
