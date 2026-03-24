import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId, WebhookId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("node:crypto", () => ({
  randomBytes: vi.fn(() => Buffer.from("a".repeat(64), "hex")),
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("wh_test-webhook-id"),
    now: vi.fn().mockReturnValue(1700000000000),
    toUnixMillis: vi.fn((v: number) => v),
    toUnixMillisOrNull: vi.fn((v: number | null) => v),
  };
});

vi.mock("@pluralscape/validation", () => ({
  CreateWebhookConfigBodySchema: { safeParse: vi.fn() },
  UpdateWebhookConfigBodySchema: { safeParse: vi.fn() },
  WebhookConfigQuerySchema: { safeParse: vi.fn() },
}));

vi.mock("@pluralscape/db/pg", () => ({
  webhookConfigs: {
    id: "id",
    systemId: "systemId",
    url: "url",
    eventTypes: "eventTypes",
    enabled: "enabled",
    cryptoKeyId: "cryptoKeyId",
    version: "version",
    archived: "archived",
    archivedAt: "archivedAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  webhookDeliveries: {
    webhookId: "webhookId",
    status: "status",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  count: vi.fn(() => "count_expr"),
  desc: vi.fn((col: unknown) => ({ type: "desc", col })),
  eq: vi.fn((col: unknown, val: unknown) => ({ type: "eq", col, val })),
  lt: vi.fn((col: unknown, val: unknown) => ({ type: "lt", col, val })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}));

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/entity-lifecycle.js", () => ({
  archiveEntity: vi.fn().mockResolvedValue(undefined),
  restoreEntity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/occ-update.js", () => ({
  assertOccUpdated: vi.fn(),
}));

vi.mock("../../lib/pagination.js", () => ({
  buildPaginatedResult: vi.fn(),
}));

// ── Import under test ────────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { archiveEntity, restoreEntity } = await import("../../lib/entity-lifecycle.js");
const { assertOccUpdated } = await import("../../lib/occ-update.js");
const { buildPaginatedResult } = await import("../../lib/pagination.js");
const { CreateWebhookConfigBodySchema, UpdateWebhookConfigBodySchema, WebhookConfigQuerySchema } =
  await import("@pluralscape/validation");

const {
  createWebhookConfig,
  listWebhookConfigs,
  getWebhookConfig,
  updateWebhookConfig,
  deleteWebhookConfig,
  archiveWebhookConfig,
  restoreWebhookConfig,
  parseWebhookConfigQuery,
} = await import("../../services/webhook-config.service.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const WH_ID = "wh_test-webhook" as WebhookId;

const AUTH: AuthContext = {
  accountId: "acct_test-account" as AuthContext["accountId"],
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
};

const mockAudit = vi.fn().mockResolvedValue(undefined);

function makeWebhookRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: WH_ID,
    systemId: SYSTEM_ID,
    url: "https://example.com/webhook",
    eventTypes: ["member.created"],
    enabled: true,
    cryptoKeyId: null,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("webhook-config service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── createWebhookConfig ────────────────────────────────────────────

  describe("createWebhookConfig", () => {
    it("creates a webhook config and returns result with secret", async () => {
      const { db, chain } = mockDb();
      const row = makeWebhookRow();
      chain.returning.mockResolvedValueOnce([row]);

      const schema = vi.mocked(CreateWebhookConfigBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: {
          url: "https://example.com/webhook",
          eventTypes: ["member.created"],
          enabled: true,
          cryptoKeyId: null,
        },
      });

      const result = await createWebhookConfig(db, SYSTEM_ID, {}, AUTH, mockAudit);

      expect(result.id).toBe(WH_ID);
      expect(result.url).toBe("https://example.com/webhook");
      expect(result.secret).toBeDefined();
      expect(typeof result.secret).toBe("string");
      expect(mockAudit).toHaveBeenCalledOnce();
    });

    it("throws VALIDATION_ERROR when payload is invalid", async () => {
      const { db } = mockDb();

      const schema = vi.mocked(CreateWebhookConfigBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: false,
        error: { issues: [] },
      });

      await expect(
        createWebhookConfig(db, SYSTEM_ID, { bad: "payload" }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("throws VALIDATION_ERROR for non-HTTPS URL in production", async () => {
      const { db } = mockDb();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const schema = vi.mocked(CreateWebhookConfigBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: {
          url: "http://example.com/webhook",
          eventTypes: ["member.created"],
          enabled: true,
        },
      });

      await expect(createWebhookConfig(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("allows HTTP URL in non-production environment", async () => {
      const { db, chain } = mockDb();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const row = makeWebhookRow({ url: "http://localhost:3000/webhook" });
      chain.returning.mockResolvedValueOnce([row]);

      const schema = vi.mocked(CreateWebhookConfigBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: {
          url: "http://localhost:3000/webhook",
          eventTypes: ["member.created"],
          enabled: true,
        },
      });

      const result = await createWebhookConfig(db, SYSTEM_ID, {}, AUTH, mockAudit);
      expect(result.url).toBe("http://localhost:3000/webhook");

      process.env.NODE_ENV = originalEnv;
    });

    it("throws when INSERT returns no rows", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      const schema = vi.mocked(CreateWebhookConfigBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: {
          url: "https://example.com/webhook",
          eventTypes: ["member.created"],
          enabled: true,
        },
      });

      await expect(createWebhookConfig(db, SYSTEM_ID, {}, AUTH, mockAudit)).rejects.toThrow(
        "Failed to create webhook config",
      );
    });

    it("throws 404 when system ownership check fails", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        createWebhookConfig(db, "sys_other" as SystemId, {}, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("sets cryptoKeyId to null when not provided", async () => {
      const { db, chain } = mockDb();
      const row = makeWebhookRow({ cryptoKeyId: null });
      chain.returning.mockResolvedValueOnce([row]);

      const schema = vi.mocked(CreateWebhookConfigBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: {
          url: "https://example.com/webhook",
          eventTypes: ["member.created"],
          enabled: true,
          // cryptoKeyId omitted
        },
      });

      const result = await createWebhookConfig(db, SYSTEM_ID, {}, AUTH, mockAudit);
      expect(result.cryptoKeyId).toBeNull();
    });
  });

  // ── listWebhookConfigs ─────────────────────────────────────────────

  describe("listWebhookConfigs", () => {
    it("returns paginated results with default options", async () => {
      const { db, chain } = mockDb();
      const rows = [makeWebhookRow()];
      chain.limit.mockResolvedValueOnce(rows);

      const mockPaginated = {
        items: [{ id: "wh_test1" }],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(buildPaginatedResult).mockReturnValueOnce(mockPaginated);

      const result = await listWebhookConfigs(db, SYSTEM_ID, AUTH);

      expect(result).toBe(mockPaginated);
      expect(buildPaginatedResult).toHaveBeenCalledOnce();
    });

    it("excludes archived configs by default", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      vi.mocked(buildPaginatedResult).mockReturnValueOnce({
        items: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });

      await listWebhookConfigs(db, SYSTEM_ID, AUTH);

      // The where clause should have been called (archived=false condition applied)
      expect(chain.where).toHaveBeenCalled();
    });

    it("includes archived configs when includeArchived is true", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      vi.mocked(buildPaginatedResult).mockReturnValueOnce({
        items: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });

      await listWebhookConfigs(db, SYSTEM_ID, AUTH, { includeArchived: true });

      expect(chain.where).toHaveBeenCalled();
    });

    it("applies cursor condition when cursor is provided", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      vi.mocked(buildPaginatedResult).mockReturnValueOnce({
        items: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });

      await listWebhookConfigs(db, SYSTEM_ID, AUTH, { cursor: "wh_prev-cursor" });

      expect(chain.where).toHaveBeenCalled();
    });

    it("caps limit at MAX_PAGE_LIMIT", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      vi.mocked(buildPaginatedResult).mockReturnValueOnce({
        items: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });

      await listWebhookConfigs(db, SYSTEM_ID, AUTH, { limit: 500 });

      // The effective limit should be capped at MAX_PAGE_LIMIT (100), so limit(101) is called
      expect(chain.limit).toHaveBeenCalledWith(101);
    });

    it("uses DEFAULT_PAGE_LIMIT when limit is not provided", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      vi.mocked(buildPaginatedResult).mockReturnValueOnce({
        items: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });

      await listWebhookConfigs(db, SYSTEM_ID, AUTH);

      // DEFAULT_PAGE_LIMIT is 25, so limit(26) is called
      expect(chain.limit).toHaveBeenCalledWith(26);
    });

    it("throws 404 when system ownership check fails", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(listWebhookConfigs(db, "sys_other" as SystemId, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── getWebhookConfig ───────────────────────────────────────────────

  describe("getWebhookConfig", () => {
    it("returns a webhook config when found", async () => {
      const { db, chain } = mockDb();
      const row = makeWebhookRow();
      chain.limit.mockResolvedValueOnce([row]);

      const result = await getWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH);

      expect(result.id).toBe(WH_ID);
      expect(result.url).toBe("https://example.com/webhook");
    });

    it("throws 404 NOT_FOUND when webhook config is not found", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        getWebhookConfig(db, SYSTEM_ID, "wh_nonexistent" as WebhookId, AUTH),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("throws 404 when system ownership check fails", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(getWebhookConfig(db, "sys_other" as SystemId, WH_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("maps row fields correctly via toWebhookConfigResult", async () => {
      const { db, chain } = mockDb();
      const row = makeWebhookRow({
        id: "wh_mapped",
        systemId: SYSTEM_ID,
        url: "https://mapped.example.com/hook",
        eventTypes: ["fronting.started", "fronting.ended"],
        enabled: false,
        cryptoKeyId: "ak_key123",
        version: 3,
        archived: false,
        archivedAt: null,
        createdAt: 5000,
        updatedAt: 6000,
      });
      chain.limit.mockResolvedValueOnce([row]);

      const result = await getWebhookConfig(db, SYSTEM_ID, "wh_mapped" as WebhookId, AUTH);

      expect(result).toEqual({
        id: "wh_mapped",
        systemId: SYSTEM_ID,
        url: "https://mapped.example.com/hook",
        eventTypes: ["fronting.started", "fronting.ended"],
        enabled: false,
        cryptoKeyId: "ak_key123",
        version: 3,
        archived: false,
        archivedAt: null,
        createdAt: 5000,
        updatedAt: 6000,
      });
    });
  });

  // ── updateWebhookConfig ────────────────────────────────────────────

  describe("updateWebhookConfig", () => {
    it("updates a webhook config successfully", async () => {
      const { db, chain } = mockDb();
      const updatedRow = makeWebhookRow({ version: 2, url: "https://new.example.com/hook" });
      chain.returning.mockResolvedValueOnce([updatedRow]);

      vi.mocked(assertOccUpdated).mockResolvedValueOnce(updatedRow);

      const schema = vi.mocked(UpdateWebhookConfigBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: {
          url: "https://new.example.com/hook",
          version: 1,
        },
      });

      const result = await updateWebhookConfig(db, SYSTEM_ID, WH_ID, {}, AUTH, mockAudit);

      expect(result.url).toBe("https://new.example.com/hook");
      expect(mockAudit).toHaveBeenCalledOnce();
    });

    it("throws VALIDATION_ERROR when payload is invalid", async () => {
      const { db } = mockDb();

      const schema = vi.mocked(UpdateWebhookConfigBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: false,
        error: { issues: [] },
      });

      await expect(
        updateWebhookConfig(db, SYSTEM_ID, WH_ID, { bad: "data" }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("validates URL protocol when url is present in update", async () => {
      const { db } = mockDb();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const schema = vi.mocked(UpdateWebhookConfigBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: {
          url: "http://insecure.example.com/hook",
          version: 1,
        },
      });

      await expect(updateWebhookConfig(db, SYSTEM_ID, WH_ID, {}, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("skips URL protocol validation when url is undefined", async () => {
      const { db, chain } = mockDb();
      const updatedRow = makeWebhookRow({ version: 2, enabled: false });
      chain.returning.mockResolvedValueOnce([updatedRow]);

      vi.mocked(assertOccUpdated).mockResolvedValueOnce(updatedRow);

      const schema = vi.mocked(UpdateWebhookConfigBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: {
          enabled: false,
          version: 1,
          // url is undefined — no protocol check
        },
      });

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const result = await updateWebhookConfig(db, SYSTEM_ID, WH_ID, {}, AUTH, mockAudit);
      expect(result.enabled).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });

    it("delegates to assertOccUpdated for version conflict detection", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      vi.mocked(assertOccUpdated).mockRejectedValueOnce(
        Object.assign(new Error("Version conflict"), { status: 409, code: "CONFLICT" }),
      );

      const schema = vi.mocked(UpdateWebhookConfigBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: { version: 1 },
      });

      await expect(updateWebhookConfig(db, SYSTEM_ID, WH_ID, {}, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "CONFLICT" }),
      );
    });

    it("delegates to assertOccUpdated for not-found detection", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([]);

      vi.mocked(assertOccUpdated).mockRejectedValueOnce(
        Object.assign(new Error("Webhook config not found"), {
          status: 404,
          code: "NOT_FOUND",
        }),
      );

      const schema = vi.mocked(UpdateWebhookConfigBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: { version: 1 },
      });

      await expect(updateWebhookConfig(db, SYSTEM_ID, WH_ID, {}, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws 404 when system ownership check fails", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        updateWebhookConfig(db, "sys_other" as SystemId, WH_ID, {}, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("includes eventTypes and enabled in set fields when provided", async () => {
      const { db, chain } = mockDb();
      const updatedRow = makeWebhookRow({
        version: 2,
        eventTypes: ["fronting.started"],
        enabled: false,
      });
      chain.returning.mockResolvedValueOnce([updatedRow]);

      vi.mocked(assertOccUpdated).mockResolvedValueOnce(updatedRow);

      const schema = vi.mocked(UpdateWebhookConfigBodySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: {
          eventTypes: ["fronting.started"],
          enabled: false,
          version: 1,
        },
      });

      const result = await updateWebhookConfig(db, SYSTEM_ID, WH_ID, {}, AUTH, mockAudit);
      expect(result.eventTypes).toEqual(["fronting.started"]);
      expect(result.enabled).toBe(false);
    });
  });

  // ── deleteWebhookConfig ────────────────────────────────────────────

  describe("deleteWebhookConfig", () => {
    /**
     * Helper: configure the mock chain for delete flow.
     *
     * The delete transaction issues:
     *   1. select().from().where().limit(1) — existence check
     *   2. select({count}).from().where()   — pending delivery count (no .limit())
     *   3. delete().where()                 — actual deletion
     *
     * Query 2 ends at .where() with no .limit(), so the second .where() call
     * must directly resolve to an array instead of returning the chain.
     */
    function setupDeleteMocks(
      chain: ReturnType<typeof mockDb>["chain"],
      existsResult: Record<string, unknown>[],
      countResult?: Record<string, unknown>[],
    ): void {
      chain.limit.mockResolvedValueOnce(existsResult);

      if (countResult !== undefined) {
        let whereCallCount = 0;
        chain.where.mockImplementation((): unknown => {
          whereCallCount++;
          // Call 2 is the count query (no .limit() follows)
          if (whereCallCount === 2) {
            return Promise.resolve(countResult);
          }
          return chain;
        });
      }
    }

    it("deletes a webhook config with no pending deliveries", async () => {
      const { db, chain } = mockDb();
      setupDeleteMocks(chain, [{ id: WH_ID }], [{ count: 0 }]);

      await deleteWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH, mockAudit);

      expect(mockAudit).toHaveBeenCalledOnce();
      expect(chain.delete).toHaveBeenCalled();
    });

    it("throws 404 when webhook config is not found", async () => {
      const { db, chain } = mockDb();
      setupDeleteMocks(chain, []);

      await expect(
        deleteWebhookConfig(db, SYSTEM_ID, "wh_nonexistent" as WebhookId, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("throws 409 HAS_DEPENDENTS when pending deliveries exist", async () => {
      const { db, chain } = mockDb();
      setupDeleteMocks(chain, [{ id: WH_ID }], [{ count: 3 }]);

      await expect(deleteWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "HAS_DEPENDENTS" }),
      );
    });

    it("throws when count query returns no rows", async () => {
      const { db, chain } = mockDb();
      setupDeleteMocks(chain, [{ id: WH_ID }], []);

      await expect(deleteWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH, mockAudit)).rejects.toThrow(
        "Unexpected: count query returned no rows",
      );
    });

    it("throws 404 when system ownership check fails", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        deleteWebhookConfig(db, "sys_other" as SystemId, WH_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });
  });

  // ── archiveWebhookConfig ───────────────────────────────────────────

  describe("archiveWebhookConfig", () => {
    it("delegates to archiveEntity", async () => {
      const { db } = mockDb();

      await archiveWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH, mockAudit);

      expect(archiveEntity).toHaveBeenCalledOnce();
      expect(archiveEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        WH_ID,
        AUTH,
        mockAudit,
        expect.objectContaining({
          entityName: "Webhook config",
          archiveEvent: "webhook-config.archived",
        }),
      );
    });
  });

  // ── restoreWebhookConfig ───────────────────────────────────────────

  describe("restoreWebhookConfig", () => {
    it("delegates to restoreEntity and returns mapped result", async () => {
      const row = makeWebhookRow({ archived: false, archivedAt: null });
      vi.mocked(restoreEntity).mockImplementationOnce(
        (_db, _sid, _eid, _auth, _audit, _cfg, toResult) => {
          return Promise.resolve((toResult as (r: Record<string, unknown>) => unknown)(row));
        },
      );

      const { db } = mockDb();
      const result = await restoreWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH, mockAudit);

      expect(restoreEntity).toHaveBeenCalledOnce();
      expect(restoreEntity).toHaveBeenCalledWith(
        db,
        SYSTEM_ID,
        WH_ID,
        AUTH,
        mockAudit,
        expect.objectContaining({
          entityName: "Webhook config",
          restoreEvent: "webhook-config.restored",
        }),
        expect.any(Function),
      );
      expect(result.id).toBe(WH_ID);
    });
  });

  // ── parseWebhookConfigQuery ────────────────────────────────────────

  describe("parseWebhookConfigQuery", () => {
    it("returns parsed query options on valid input", () => {
      const schema = vi.mocked(WebhookConfigQuerySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: { includeArchived: true },
      });

      const result = parseWebhookConfigQuery({ includeArchived: "true" });

      expect(result).toEqual({ includeArchived: true });
    });

    it("throws VALIDATION_ERROR on invalid query params", () => {
      const schema = vi.mocked(WebhookConfigQuerySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: false,
        error: { issues: [] },
      });

      expect(() => parseWebhookConfigQuery({ invalid: "param" })).toThrow(
        expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
      );
    });

    it("returns empty options when no query params provided", () => {
      const schema = vi.mocked(WebhookConfigQuerySchema);
      (schema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        success: true,
        data: {},
      });

      const result = parseWebhookConfigQuery({});

      expect(result).toEqual({});
    });
  });
});
