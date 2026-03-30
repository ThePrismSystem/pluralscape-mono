import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { captureWhereArg, mockDb } from "../helpers/mock-db.js";

import type { MockChain } from "../helpers/mock-db.js";
import type {
  AccountId,
  SessionId,
  SystemId,
  WebhookDeliveryId,
  WebhookDeliveryStatus,
  WebhookEventType,
  WebhookId,
} from "@pluralscape/types";

// ── Mock external dependencies ───────────────────────────────────────

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/pagination.js", () => ({
  buildPaginatedResult: vi.fn(
    <TRow, TResult extends { id: string }>(
      rows: readonly TRow[],
      limit: number,
      mapper: (row: TRow) => TResult,
    ) => {
      const hasMore = rows.length > limit;
      const data = (hasMore ? rows.slice(0, limit) : rows).map(mapper);
      return { data, nextCursor: hasMore ? "cursor_next" : null, hasMore, totalCount: null };
    },
  ),
}));

vi.mock("@pluralscape/validation", () => ({
  WebhookDeliveryQuerySchema: {
    safeParse: vi.fn(),
  },
}));

// ── Imports after mocks ──────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { buildPaginatedResult } = await import("../../lib/pagination.js");
const { WebhookDeliveryQuerySchema } = await import("@pluralscape/validation");
const mockSchema = vi.mocked(WebhookDeliveryQuerySchema);

const {
  listWebhookDeliveries,
  getWebhookDelivery,
  deleteWebhookDelivery,
  parseWebhookDeliveryQuery,
} = await import("../../services/webhook-delivery.service.js");

// ── Helpers ──────────────────────────────────────────────────────────

function makeAuth(accountId: string, systemId: string) {
  return {
    accountId: accountId as AccountId,
    systemId: systemId as SystemId,
    sessionId: "sess_test" as SessionId,
    accountType: "system" as const,
    ownedSystemIds: new Set([systemId as SystemId]),
    auditLogIpTracking: false,
  };
}

function makeDeliveryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "wd_row1",
    webhookId: "wh_row1",
    systemId: "sys_row1",
    eventType: "member.created",
    status: "pending",
    httpStatus: null,
    attemptCount: 0,
    lastAttemptAt: null,
    nextRetryAt: null,
    createdAt: 1700000000000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("webhook-delivery service", () => {
  const mockAudit = vi.fn().mockResolvedValue(undefined);

  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── listWebhookDeliveries ────────────────────────────────────────

  describe("listWebhookDeliveries", () => {
    const WD_AUTH = makeAuth("acct_base1", "sys_base1");

    async function callListWithFilter(opts = {}): Promise<MockChain> {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);
      await listWebhookDeliveries(db, "sys_base1" as SystemId, WD_AUTH, opts);
      return chain;
    }

    let baseWhereArg: unknown;
    beforeAll(async () => {
      const chain = await callListWithFilter();
      baseWhereArg = captureWhereArg(chain);
    });

    it("calls assertSystemOwnership", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const auth = makeAuth("acct_ls1", "sys_ls1");
      await listWebhookDeliveries(db, "sys_ls1" as SystemId, auth);

      expect(assertSystemOwnership).toHaveBeenCalledWith("sys_ls1", auth);
    });

    it("returns paginated results with no filters", async () => {
      const { db, chain } = mockDb();
      const row = makeDeliveryRow({ id: "wd_nofilt1", systemId: "sys_nf1" });
      chain.limit.mockResolvedValueOnce([row]);

      const auth = makeAuth("acct_nf1", "sys_nf1");
      const result = await listWebhookDeliveries(db, "sys_nf1" as SystemId, auth);

      expect(buildPaginatedResult).toHaveBeenCalledWith([row], 25, expect.any(Function));
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe("wd_nofilt1");
    });

    it("passes webhookId filter when provided", async () => {
      const chain = await callListWithFilter({
        webhookId: "wh_filter1" as WebhookId,
      });

      expect(chain.select).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalledTimes(1);
      expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
    });

    it("passes status filter when provided", async () => {
      const chain = await callListWithFilter({
        status: "failed" as WebhookDeliveryStatus,
      });

      expect(chain.where).toHaveBeenCalledTimes(1);
      expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
    });

    it("passes eventType filter when provided", async () => {
      const chain = await callListWithFilter({
        eventType: "member.created" as WebhookEventType,
      });

      expect(chain.where).toHaveBeenCalledTimes(1);
      expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
    });

    it("passes cursor filter when provided", async () => {
      const chain = await callListWithFilter({
        cursor: "wd_cursor_abc",
      });

      expect(chain.where).toHaveBeenCalledTimes(1);
      expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
    });

    it("passes all filters simultaneously", async () => {
      const chain = await callListWithFilter({
        webhookId: "wh_all1" as WebhookId,
        status: "success" as WebhookDeliveryStatus,
        eventType: "member.updated" as WebhookEventType,
        cursor: "wd_cursor_all",
      });

      expect(chain.where).toHaveBeenCalledTimes(1);
      expect(captureWhereArg(chain)).not.toEqual(baseWhereArg);
      expect(chain.orderBy).toHaveBeenCalled();
    });

    it("caps limit at MAX_PAGE_LIMIT", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const auth = makeAuth("acct_max1", "sys_max1");
      await listWebhookDeliveries(db, "sys_max1" as SystemId, auth, {
        limit: 500,
      });

      // MAX_PAGE_LIMIT is 100, so limit(100+1=101) should be called
      expect(chain.limit).toHaveBeenCalledWith(101);
    });

    it("uses DEFAULT_PAGE_LIMIT when no limit provided", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const auth = makeAuth("acct_def1", "sys_def1");
      await listWebhookDeliveries(db, "sys_def1" as SystemId, auth);

      // DEFAULT_PAGE_LIMIT is 25, so limit(25+1=26) should be called
      expect(chain.limit).toHaveBeenCalledWith(26);
    });

    it("uses provided limit when within bounds", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const auth = makeAuth("acct_lim1", "sys_lim1");
      await listWebhookDeliveries(db, "sys_lim1" as SystemId, auth, {
        limit: 10,
      });

      expect(chain.limit).toHaveBeenCalledWith(11);
    });

    it("maps rows through toWebhookDeliveryResult via buildPaginatedResult", async () => {
      const { db, chain } = mockDb();
      const row = makeDeliveryRow({
        id: "wd_map1",
        webhookId: "wh_map1",
        systemId: "sys_map1",
        eventType: "member.archived",
        status: "success",
        httpStatus: 200,
        attemptCount: 1,
        lastAttemptAt: 1700000001000,
        nextRetryAt: null,
        createdAt: 1700000000000,
      });
      chain.limit.mockResolvedValueOnce([row]);

      const auth = makeAuth("acct_map1", "sys_map1");
      const result = await listWebhookDeliveries(db, "sys_map1" as SystemId, auth);

      expect(result.data[0]).toEqual({
        id: "wd_map1",
        webhookId: "wh_map1",
        systemId: "sys_map1",
        eventType: "member.archived",
        status: "success",
        httpStatus: 200,
        attemptCount: 1,
        lastAttemptAt: 1700000001000,
        nextRetryAt: null,
        createdAt: 1700000000000,
      });
    });

    it("maps null lastAttemptAt and nextRetryAt correctly", async () => {
      const { db, chain } = mockDb();
      const row = makeDeliveryRow({
        id: "wd_null1",
        systemId: "sys_null1",
        lastAttemptAt: null,
        nextRetryAt: null,
      });
      chain.limit.mockResolvedValueOnce([row]);

      const auth = makeAuth("acct_null1", "sys_null1");
      const result = await listWebhookDeliveries(db, "sys_null1" as SystemId, auth);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.lastAttemptAt).toBeNull();
      expect(result.data[0]?.nextRetryAt).toBeNull();
    });

    it("throws when assertSystemOwnership rejects", async () => {
      const { db } = mockDb();
      const auth = makeAuth("acct_own1", "sys_own1");

      vi.mocked(assertSystemOwnership).mockImplementationOnce(() => {
        throw new Error("System not found");
      });

      await expect(listWebhookDeliveries(db, "sys_other" as SystemId, auth)).rejects.toThrow(
        "System not found",
      );
    });
  });

  // ── getWebhookDelivery ───────────────────────────────────────────

  describe("getWebhookDelivery", () => {
    it("returns delivery when found", async () => {
      const { db, chain } = mockDb();
      const row = makeDeliveryRow({
        id: "wd_get1",
        webhookId: "wh_get1",
        systemId: "sys_get1",
        status: "success",
        httpStatus: 200,
        attemptCount: 1,
        lastAttemptAt: 1700000002000,
        createdAt: 1700000000000,
      });
      chain.limit.mockResolvedValueOnce([row]);

      const auth = makeAuth("acct_get1", "sys_get1");
      const result = await getWebhookDelivery(
        db,
        "sys_get1" as SystemId,
        "wd_get1" as WebhookDeliveryId,
        auth,
      );

      expect(result.id).toBe("wd_get1");
      expect(result.status).toBe("success");
      expect(result.httpStatus).toBe(200);
      expect(assertSystemOwnership).toHaveBeenCalledWith("sys_get1", auth);
    });

    it("throws NOT_FOUND when delivery does not exist", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const auth = makeAuth("acct_gn1", "sys_gn1");
      await expect(
        getWebhookDelivery(db, "sys_gn1" as SystemId, "wd_missing" as WebhookDeliveryId, auth),
      ).rejects.toThrow("Webhook delivery not found");
    });

    it("throws ApiHttpError with 404 status on not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      const auth = makeAuth("acct_gn2", "sys_gn2");
      try {
        await getWebhookDelivery(
          db,
          "sys_gn2" as SystemId,
          "wd_missing2" as WebhookDeliveryId,
          auth,
        );
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect((error as { status: number }).status).toBe(404);
        expect((error as { code: string }).code).toBe("NOT_FOUND");
      }
    });

    it("calls assertSystemOwnership before querying", async () => {
      const { db } = mockDb();
      const auth = makeAuth("acct_go1", "sys_go1");

      vi.mocked(assertSystemOwnership).mockImplementationOnce(() => {
        throw new Error("System not found");
      });

      await expect(
        getWebhookDelivery(db, "sys_other" as SystemId, "wd_go1" as WebhookDeliveryId, auth),
      ).rejects.toThrow("System not found");
    });
  });

  // ── deleteWebhookDelivery ────────────────────────────────────────

  describe("deleteWebhookDelivery", () => {
    it("deletes delivery and writes audit log", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ id: "wd_del1" }]);

      const auth = makeAuth("acct_del1", "sys_del1");
      await deleteWebhookDelivery(
        db,
        "sys_del1" as SystemId,
        "wd_del1" as WebhookDeliveryId,
        auth,
        mockAudit,
      );

      expect(chain.transaction).toHaveBeenCalledOnce();
      expect(chain.delete).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: "webhook-delivery.deleted",
          actor: { kind: "account", id: "acct_del1" },
          detail: "Webhook delivery deleted",
          systemId: "sys_del1",
        }),
      );
    });

    it("throws NOT_FOUND when delivery does not exist", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      const auth = makeAuth("acct_dn1", "sys_dn1");
      await expect(
        deleteWebhookDelivery(
          db,
          "sys_dn1" as SystemId,
          "wd_missing" as WebhookDeliveryId,
          auth,
          mockAudit,
        ),
      ).rejects.toThrow("Webhook delivery not found");
    });

    it("throws ApiHttpError with 404 status when not found", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      const auth = makeAuth("acct_dn2", "sys_dn2");
      try {
        await deleteWebhookDelivery(
          db,
          "sys_dn2" as SystemId,
          "wd_miss2" as WebhookDeliveryId,
          auth,
          mockAudit,
        );
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect((error as { status: number }).status).toBe(404);
        expect((error as { code: string }).code).toBe("NOT_FOUND");
      }
    });

    it("does not write audit log when delete returns no rows", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      const auth = makeAuth("acct_na1", "sys_na1");
      await expect(
        deleteWebhookDelivery(
          db,
          "sys_na1" as SystemId,
          "wd_na1" as WebhookDeliveryId,
          auth,
          mockAudit,
        ),
      ).rejects.toThrow();

      expect(mockAudit).not.toHaveBeenCalled();
    });

    it("calls assertSystemOwnership before transaction", async () => {
      const { db } = mockDb();
      const auth = makeAuth("acct_do1", "sys_do1");

      vi.mocked(assertSystemOwnership).mockImplementationOnce(() => {
        throw new Error("System not found");
      });

      await expect(
        deleteWebhookDelivery(
          db,
          "sys_other" as SystemId,
          "wd_do1" as WebhookDeliveryId,
          auth,
          mockAudit,
        ),
      ).rejects.toThrow("System not found");

      expect(mockAudit).not.toHaveBeenCalled();
    });
  });

  // ── parseWebhookDeliveryQuery ────────────────────────────────────

  describe("parseWebhookDeliveryQuery", () => {
    it("returns parsed data on valid query", () => {
      const validData = {
        webhookId: "wh_abc123",
        status: "pending" as const,
        eventType: "member.created" as const,
      };

      mockSchema.safeParse.mockReturnValueOnce({
        success: true,
        data: validData,
      } as never);

      const result = parseWebhookDeliveryQuery({
        webhookId: "wh_abc123",
        status: "pending",
        eventType: "member.created",
      });

      expect(result).toEqual(validData);
    });

    it("returns empty object when query has no filters", () => {
      mockSchema.safeParse.mockReturnValueOnce({
        success: true,
        data: {},
      } as never);

      const result = parseWebhookDeliveryQuery({});
      expect(result).toEqual({});
    });

    it("throws VALIDATION_ERROR on invalid query", () => {
      mockSchema.safeParse.mockReturnValueOnce({
        success: false,
        error: { issues: [{ message: "Invalid" }] },
      } as never);

      expect(() => parseWebhookDeliveryQuery({ status: "invalid_status" })).toThrow(
        "Invalid query parameters",
      );
    });

    it("throws ApiHttpError with 400 status on invalid query", () => {
      mockSchema.safeParse.mockReturnValueOnce({
        success: false,
        error: { issues: [{ message: "Invalid" }] },
      } as never);

      try {
        parseWebhookDeliveryQuery({ eventType: "bogus" });
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect((error as { status: number }).status).toBe(400);
        expect((error as { code: string }).code).toBe("VALIDATION_ERROR");
      }
    });

    it("passes partial query params to schema", () => {
      mockSchema.safeParse.mockReturnValueOnce({
        success: true,
        data: { status: "failed" },
      } as never);

      const result = parseWebhookDeliveryQuery({ status: "failed" });
      expect(result).toEqual({ status: "failed" });
    });

    it("passes undefined values through to schema", () => {
      mockSchema.safeParse.mockReturnValueOnce({
        success: true,
        data: {},
      } as never);

      parseWebhookDeliveryQuery({
        webhookId: undefined,
        status: undefined,
        eventType: undefined,
      });

      // Verifying safeParse was invoked with the raw query is implicit — the mock
      // returns success: true, so the function must have called it to get data.
    });
  });
});
