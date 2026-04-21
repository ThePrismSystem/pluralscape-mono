import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { BucketContentEntityType, BucketId, SystemId } from "@pluralscape/types";

// ── Mock tx ──────────────────────────────────────────────────────────

const mockTx = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  delete: vi.fn(),
  onConflictDoNothing: vi.fn(),
};

function wireChain(): void {
  mockTx.select.mockReturnValue(mockTx);
  mockTx.from.mockReturnValue(mockTx);
  mockTx.where.mockReturnValue(mockTx);
  mockTx.limit.mockResolvedValue([]);
  mockTx.insert.mockReturnValue(mockTx);
  mockTx.values.mockReturnValue(mockTx);
  mockTx.onConflictDoNothing.mockReturnValue(mockTx);
  mockTx.returning.mockResolvedValue([]);
  mockTx.delete.mockReturnValue(mockTx);
}

// ── Mocks ────────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../services/bucket/internal.js", () => ({
  assertBucketExists: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../lib/rls-context.js", () => ({
  withTenantTransaction: vi.fn(
    (_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockTx),
  ),
  withTenantRead: vi.fn((_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockTx),
  ),
}));

vi.mock("../../lib/tenant-context.js", () => ({
  tenantCtx: vi.fn(() => ({ systemId: SYSTEM_ID, accountId: "acct_test" })),
}));

vi.mock("@pluralscape/db/pg", () => ({
  bucketContentTags: {
    entityType: "entity_type",
    entityId: "entity_id",
    bucketId: "bucket_id",
    systemId: "system_id",
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { assertBucketExists } = await import("../../services/bucket/internal.js");
const { dispatchWebhookEvent } = await import("../../services/webhook-dispatcher.js");

const { tagContent, untagContent, listTagsByBucket, parseTagQuery } =
  await import("../../services/bucket-content-tag.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const BUCKET_ID = brandId<BucketId>("bkt_test-bucket");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);
const ENTITY_TYPE: BucketContentEntityType = "member";
const ENTITY_ID = "mem_test-entity";

function makeTagRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    entityType: ENTITY_TYPE,
    entityId: ENTITY_ID,
    bucketId: BUCKET_ID,
    systemId: SYSTEM_ID,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("bucket-content-tag service", () => {
  afterEach(() => {
    mockAudit.mockClear();
    vi.mocked(assertBucketExists).mockReset().mockResolvedValue(undefined);
    vi.mocked(dispatchWebhookEvent).mockReset().mockResolvedValue([]);
    // Reset all mockTx methods before re-wiring to clear any Once queues
    for (const fn of Object.values(mockTx)) {
      if (typeof fn === "function" && "mockReset" in fn) {
        (fn as ReturnType<typeof vi.fn>).mockReset();
      }
    }
    wireChain();
  });

  wireChain();

  // ── tagContent ────────────────────────────────────────────────────

  describe("tagContent", () => {
    const validPayload = { entityType: ENTITY_TYPE, entityId: ENTITY_ID };

    it("tags content and returns result", async () => {
      mockTx.returning.mockResolvedValueOnce([makeTagRow()]);

      const result = await tagContent(
        {} as never,
        SYSTEM_ID,
        BUCKET_ID,
        validPayload,
        AUTH,
        mockAudit,
      );

      expect(result.entityType).toBe(ENTITY_TYPE);
      expect(result.entityId).toBe(ENTITY_ID);
      expect(result.bucketId).toBe(BUCKET_ID);
      expect(mockAudit).toHaveBeenCalled();
      expect(dispatchWebhookEvent).toHaveBeenCalled();
    });

    it("returns result without audit/webhook on conflict (duplicate tag)", async () => {
      mockTx.returning.mockResolvedValueOnce([]);

      const result = await tagContent(
        {} as never,
        SYSTEM_ID,
        BUCKET_ID,
        validPayload,
        AUTH,
        mockAudit,
      );

      expect(result.entityType).toBe(ENTITY_TYPE);
      expect(mockAudit).not.toHaveBeenCalled();
      expect(dispatchWebhookEvent).not.toHaveBeenCalled();
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      await expect(
        tagContent({} as never, SYSTEM_ID, BUCKET_ID, { bad: true }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        tagContent({} as never, SYSTEM_ID, BUCKET_ID, validPayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404 }));
    });

    it("calls assertBucketExists", async () => {
      mockTx.returning.mockResolvedValueOnce([makeTagRow()]);

      await tagContent({} as never, SYSTEM_ID, BUCKET_ID, validPayload, AUTH, mockAudit);

      expect(assertBucketExists).toHaveBeenCalledWith(mockTx, SYSTEM_ID, BUCKET_ID);
    });
  });

  // ── untagContent ──────────────────────────────────────────────────

  describe("untagContent", () => {
    it("untags content and writes audit", async () => {
      mockTx.returning.mockResolvedValueOnce([makeTagRow()]);

      await untagContent(
        {} as never,
        SYSTEM_ID,
        BUCKET_ID,
        ENTITY_TYPE,
        ENTITY_ID,
        AUTH,
        mockAudit,
      );

      expect(mockAudit).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ eventType: "bucket-content-tag.untagged" }),
      );
      expect(dispatchWebhookEvent).toHaveBeenCalled();
    });

    it("throws NOT_FOUND when tag does not exist", async () => {
      mockTx.returning.mockResolvedValueOnce([]);

      await expect(
        untagContent({} as never, SYSTEM_ID, BUCKET_ID, ENTITY_TYPE, ENTITY_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        untagContent({} as never, SYSTEM_ID, BUCKET_ID, ENTITY_TYPE, ENTITY_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404 }));
    });
  });

  // ── listTagsByBucket ──────────────────────────────────────────────

  describe("listTagsByBucket", () => {
    it("returns list of tags", async () => {
      mockTx.limit.mockResolvedValueOnce([makeTagRow(), makeTagRow({ entityId: "mem_other" })]);

      const result = await listTagsByBucket({} as never, SYSTEM_ID, BUCKET_ID, AUTH);

      expect(result).toHaveLength(2);
      expect(result[0]?.entityType).toBe(ENTITY_TYPE);
    });

    it("returns empty list when no tags", async () => {
      mockTx.limit.mockResolvedValueOnce([]);

      const result = await listTagsByBucket({} as never, SYSTEM_ID, BUCKET_ID, AUTH);
      expect(result).toHaveLength(0);
    });

    it("filters by entityType when provided", async () => {
      mockTx.limit.mockResolvedValueOnce([]);

      await listTagsByBucket({} as never, SYSTEM_ID, BUCKET_ID, AUTH, { entityType: ENTITY_TYPE });

      expect(mockTx.where).toHaveBeenCalled();
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(listTagsByBucket({} as never, SYSTEM_ID, BUCKET_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404 }),
      );
    });
  });

  // ── parseTagQuery ─────────────────────────────────────────────────

  describe("parseTagQuery", () => {
    it("parses entityType from query", () => {
      const result = parseTagQuery({ entityType: "member" });
      expect(result.entityType).toBe("member");
    });

    it("returns undefined entityType when not provided", () => {
      const result = parseTagQuery({});
      expect(result.entityType).toBeUndefined();
    });
  });
});
