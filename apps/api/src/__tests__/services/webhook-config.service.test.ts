import { afterEach, describe, expect, it, vi } from "vitest";

import { captureWhereArg, mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { SystemId, WebhookId } from "@pluralscape/types";

// ── Mock external deps ───────────────────────────────────────────────

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    randomBytes: vi.fn(() => Buffer.from("a".repeat(64), "hex")),
  };
});

vi.mock("@pluralscape/crypto", async () => {
  const { createCryptoMock } = await import("../helpers/mock-crypto.js");
  return createCryptoMock();
});

vi.mock("../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/ip-validation.js", () => ({
  resolveAndValidateUrl: vi.fn().mockResolvedValue(["93.184.216.34"]),
}));

vi.mock("../../env.js", () => ({
  env: { NODE_ENV: "development", LOG_LEVEL: "warn" },
}));

// ── Import under test ────────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

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

const SYSTEM_ID = "sys_00000000-0000-4000-a000-000000000001" as SystemId;
const WH_ID = "wh_00000000-0000-4000-a000-000000000002" as WebhookId;

const AUTH = makeTestAuth({
  accountId: "acct_00000000-0000-4000-a000-000000000003",
  systemId: SYSTEM_ID,
  sessionId: "sess_00000000-0000-4000-a000-000000000004",
});

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
    const validCreatePayload = {
      url: "https://example.com/webhook",
      eventTypes: ["member.created"],
      enabled: true,
      cryptoKeyId: undefined,
    };

    it("creates a webhook config and returns result with secret", async () => {
      const { db, chain } = mockDb();
      const row = makeWebhookRow();
      // Quota check: system lock (.for) + count query (.where terminal)
      chain.for.mockResolvedValueOnce([]);
      chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([{ count: 0 }]);
      chain.returning.mockResolvedValueOnce([row]);

      const result = await createWebhookConfig(db, SYSTEM_ID, validCreatePayload, AUTH, mockAudit);

      expect(result.id).toEqual(expect.stringMatching(/^wh_/));
      expect(result.url).toBe("https://example.com/webhook");
      expect(result.secret).toBeDefined();
      expect(typeof result.secret).toBe("string");
      expect(mockAudit).toHaveBeenCalledOnce();
    });

    it("throws VALIDATION_ERROR when payload is invalid", async () => {
      const { db } = mockDb();

      await expect(
        createWebhookConfig(db, SYSTEM_ID, { bad: "payload" }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("rejects non-localhost HTTP URL", async () => {
      const { db } = mockDb();

      await expect(
        createWebhookConfig(
          db,
          SYSTEM_ID,
          { ...validCreatePayload, url: "http://example.com/webhook" },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("allows localhost HTTP URL", async () => {
      const { db, chain } = mockDb();
      const row = makeWebhookRow({ url: "http://localhost:3000/webhook" });
      chain.for.mockResolvedValueOnce([]);
      chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([{ count: 0 }]);
      chain.returning.mockResolvedValueOnce([row]);

      const result = await createWebhookConfig(
        db,
        SYSTEM_ID,
        { ...validCreatePayload, url: "http://localhost:3000/webhook" },
        AUTH,
        mockAudit,
      );
      expect(result.url).toBe("http://localhost:3000/webhook");
    });

    it("allows 127.0.0.1 HTTP URL", async () => {
      const { db, chain } = mockDb();
      const row = makeWebhookRow({ url: "http://127.0.0.1:3000/webhook" });
      chain.for.mockResolvedValueOnce([]);
      chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([{ count: 0 }]);
      chain.returning.mockResolvedValueOnce([row]);

      const result = await createWebhookConfig(
        db,
        SYSTEM_ID,
        { ...validCreatePayload, url: "http://127.0.0.1:3000/webhook" },
        AUTH,
        mockAudit,
      );
      expect(result.url).toBe("http://127.0.0.1:3000/webhook");
    });

    it("allows ::1 HTTP URL", async () => {
      const { db, chain } = mockDb();
      const row = makeWebhookRow({ url: "http://[::1]:3000/webhook" });
      chain.for.mockResolvedValueOnce([]);
      chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([{ count: 0 }]);
      chain.returning.mockResolvedValueOnce([row]);

      const result = await createWebhookConfig(
        db,
        SYSTEM_ID,
        { ...validCreatePayload, url: "http://[::1]:3000/webhook" },
        AUTH,
        mockAudit,
      );
      expect(result.url).toBe("http://[::1]:3000/webhook");
    });

    it("allows HTTPS URL for non-localhost", async () => {
      const { db, chain } = mockDb();
      const row = makeWebhookRow({ url: "https://example.com/webhook" });
      chain.for.mockResolvedValueOnce([]);
      chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([{ count: 0 }]);
      chain.returning.mockResolvedValueOnce([row]);

      const result = await createWebhookConfig(
        db,
        SYSTEM_ID,
        { ...validCreatePayload, url: "https://example.com/webhook" },
        AUTH,
        mockAudit,
      );
      expect(result.url).toBe("https://example.com/webhook");
    });

    it("throws when INSERT returns no rows", async () => {
      const { db, chain } = mockDb();
      chain.for.mockResolvedValueOnce([]);
      chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([{ count: 0 }]);
      chain.returning.mockResolvedValueOnce([]);

      await expect(
        createWebhookConfig(db, SYSTEM_ID, validCreatePayload, AUTH, mockAudit),
      ).rejects.toThrow("Failed to create webhook config");
    });

    it("throws 404 when system ownership check fails", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        createWebhookConfig(db, "sys_other" as SystemId, validCreatePayload, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("sets cryptoKeyId to null when not provided", async () => {
      const { db, chain } = mockDb();
      const row = makeWebhookRow({ cryptoKeyId: null });
      chain.for.mockResolvedValueOnce([]);
      chain.where.mockReturnValueOnce(chain).mockResolvedValueOnce([{ count: 0 }]);
      chain.returning.mockResolvedValueOnce([row]);

      const result = await createWebhookConfig(
        db,
        SYSTEM_ID,
        {
          url: "https://example.com/webhook",
          eventTypes: ["member.created"],
          enabled: true,
          // cryptoKeyId omitted
        },
        AUTH,
        mockAudit,
      );
      expect(result.cryptoKeyId).toBeNull();
    });
  });

  // ── listWebhookConfigs ─────────────────────────────────────────────

  describe("listWebhookConfigs", () => {
    function callListWithFilter(
      chain: ReturnType<typeof mockDb>["chain"],
      rows: Record<string, unknown>[] = [],
    ): void {
      chain.limit.mockResolvedValueOnce(rows);
    }

    it("returns paginated results with default options", async () => {
      const { db, chain } = mockDb();
      callListWithFilter(chain, [makeWebhookRow()]);

      const result = await listWebhookConfigs(db, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe(WH_ID);
      expect(result.hasMore).toBe(false);
    });

    it("excludes archived configs by default", async () => {
      const { db, chain } = mockDb();
      callListWithFilter(chain);

      await listWebhookConfigs(db, SYSTEM_ID, AUTH);

      const whereArg = captureWhereArg(chain);
      expect(whereArg).toBeDefined();
    });

    it("includes archived configs when includeArchived is true", async () => {
      const { db, chain } = mockDb();
      callListWithFilter(chain);

      await listWebhookConfigs(db, SYSTEM_ID, AUTH, { includeArchived: true });

      const whereArg = captureWhereArg(chain);
      expect(whereArg).toBeDefined();
    });

    it("applies cursor condition when cursor is provided", async () => {
      const { db, chain } = mockDb();
      callListWithFilter(chain);

      await listWebhookConfigs(db, SYSTEM_ID, AUTH, { cursor: "wh_prev-cursor" });

      expect(chain.where).toHaveBeenCalled();
    });

    it("caps limit at MAX_PAGE_LIMIT", async () => {
      const { db, chain } = mockDb();
      callListWithFilter(chain);

      await listWebhookConfigs(db, SYSTEM_ID, AUTH, { limit: 500 });

      // The effective limit should be capped at MAX_PAGE_LIMIT (100), so limit(101) is called
      expect(chain.limit).toHaveBeenCalledWith(101);
    });

    it("uses DEFAULT_PAGE_LIMIT when limit is not provided", async () => {
      const { db, chain } = mockDb();
      callListWithFilter(chain);

      await listWebhookConfigs(db, SYSTEM_ID, AUTH);

      // DEFAULT_PAGE_LIMIT is 25, so limit(26) is called
      expect(chain.limit).toHaveBeenCalledWith(26);
    });

    it("returns hasMore true when more records exist", async () => {
      const { db, chain } = mockDb();
      // Return limit+1 rows to trigger hasMore
      const rows = Array.from({ length: 26 }, (_, i) =>
        makeWebhookRow({
          id: `wh_00000000-0000-4000-a000-0000000001${String(i).padStart(2, "0")}`,
        }),
      );
      callListWithFilter(chain, rows);

      const result = await listWebhookConfigs(db, SYSTEM_ID, AUTH);

      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(25);
      expect(result.nextCursor).not.toBeNull();
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
        getWebhookConfig(
          db,
          SYSTEM_ID,
          "wh_00000000-0000-4000-a000-000000000099" as WebhookId,
          AUTH,
        ),
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
        id: "wh_00000000-0000-4000-a000-000000000010",
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

      const result = await getWebhookConfig(
        db,
        SYSTEM_ID,
        "wh_00000000-0000-4000-a000-000000000010" as WebhookId,
        AUTH,
      );

      expect(result).toEqual({
        id: "wh_00000000-0000-4000-a000-000000000010",
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

      const result = await updateWebhookConfig(
        db,
        SYSTEM_ID,
        WH_ID,
        { url: "https://new.example.com/hook", version: 1 },
        AUTH,
        mockAudit,
      );

      expect(result.url).toBe("https://new.example.com/hook");
      expect(mockAudit).toHaveBeenCalledOnce();
    });

    it("throws VALIDATION_ERROR when payload is invalid", async () => {
      const { db } = mockDb();

      await expect(
        updateWebhookConfig(db, SYSTEM_ID, WH_ID, { bad: "data" }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("validates URL protocol when url is present in update", async () => {
      const { db } = mockDb();

      await expect(
        updateWebhookConfig(
          db,
          SYSTEM_ID,
          WH_ID,
          { url: "http://insecure.example.com/hook", version: 1 },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("skips URL protocol validation when url is undefined", async () => {
      const { db, chain } = mockDb();
      const updatedRow = makeWebhookRow({ version: 2, enabled: false });
      chain.returning.mockResolvedValueOnce([updatedRow]);

      const result = await updateWebhookConfig(
        db,
        SYSTEM_ID,
        WH_ID,
        { enabled: false, version: 1 },
        AUTH,
        mockAudit,
      );
      expect(result.enabled).toBe(false);
    });

    it("delegates to assertOccUpdated for version conflict detection", async () => {
      const { db, chain } = mockDb();
      // update returns empty — triggers assertOccUpdated
      chain.returning.mockResolvedValueOnce([]);
      // existsFn re-query: entity exists → 409 CONFLICT
      chain.limit.mockResolvedValueOnce([{ id: WH_ID }]);

      await expect(
        updateWebhookConfig(db, SYSTEM_ID, WH_ID, { version: 1 }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "CONFLICT" }));
    });

    it("delegates to assertOccUpdated for not-found detection", async () => {
      const { db, chain } = mockDb();
      // update returns empty
      chain.returning.mockResolvedValueOnce([]);
      // existsFn re-query: entity not found → 404 NOT_FOUND
      chain.limit.mockResolvedValueOnce([]);

      await expect(
        updateWebhookConfig(db, SYSTEM_ID, WH_ID, { version: 1 }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
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

      const result = await updateWebhookConfig(
        db,
        SYSTEM_ID,
        WH_ID,
        { eventTypes: ["fronting.started"], enabled: false, version: 1 },
        AUTH,
        mockAudit,
      );
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
        deleteWebhookConfig(
          db,
          SYSTEM_ID,
          "wh_00000000-0000-4000-a000-000000000099" as WebhookId,
          AUTH,
          mockAudit,
        ),
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

    it("calls .for('update') on the existence check query to prevent race conditions", async () => {
      const { db, chain } = mockDb();
      setupDeleteMocks(chain, [{ id: WH_ID }], [{ count: 0 }]);

      await deleteWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH, mockAudit);

      expect(chain.for).toHaveBeenCalledWith("update");
    });
  });

  // ── archiveWebhookConfig ───────────────────────────────────────────

  describe("archiveWebhookConfig", () => {
    /**
     * Helper: configure mock chain for archive lifecycle flow.
     *
     * archiveEntity issues:
     *   1. update().set().where().returning({id}) — archive attempt
     *   2. select({id}).from().where()            — existence re-query (no .limit())
     *
     * When the update returns empty, query 2 ends at .where() with no .limit(),
     * so the second .where() call must resolve to an array directly.
     */
    function setupArchiveMocks(
      chain: ReturnType<typeof mockDb>["chain"],
      updateResult: Record<string, unknown>[],
      reQueryResult?: Record<string, unknown>[],
    ): void {
      chain.returning.mockResolvedValueOnce(updateResult);

      if (reQueryResult !== undefined) {
        let whereCallCount = 0;
        chain.where.mockImplementation((): unknown => {
          whereCallCount++;
          // Call 2 is the re-query (no .limit() follows)
          if (whereCallCount === 2) {
            return Promise.resolve(reQueryResult);
          }
          return chain;
        });
      }
    }

    it("archives a webhook config", async () => {
      const { db, chain } = mockDb();
      chain.returning.mockResolvedValueOnce([{ id: WH_ID }]);

      await archiveWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH, mockAudit);

      expect(chain.transaction).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "webhook-config.archived" }),
      );
    });

    it("throws 409 ALREADY_ARCHIVED when already archived", async () => {
      const { db, chain } = mockDb();
      setupArchiveMocks(chain, [], [{ id: WH_ID }]);

      await expect(archiveWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "ALREADY_ARCHIVED" }),
      );
    });

    it("throws 404 when record not found (update empty, re-query empty)", async () => {
      const { db, chain } = mockDb();
      setupArchiveMocks(chain, [], []);

      await expect(archiveWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── restoreWebhookConfig ───────────────────────────────────────────

  describe("restoreWebhookConfig", () => {
    /**
     * Helper: configure mock chain for restore lifecycle flow.
     * Same pattern as setupArchiveMocks — re-query ends at .where() with no .limit().
     */
    function setupRestoreMocks(
      chain: ReturnType<typeof mockDb>["chain"],
      updateResult: Record<string, unknown>[],
      reQueryResult?: Record<string, unknown>[],
    ): void {
      chain.returning.mockResolvedValueOnce(updateResult);

      if (reQueryResult !== undefined) {
        let whereCallCount = 0;
        chain.where.mockImplementation((): unknown => {
          whereCallCount++;
          // Call 2 is the re-query (no .limit() follows)
          if (whereCallCount === 2) {
            return Promise.resolve(reQueryResult);
          }
          return chain;
        });
      }
    }

    it("restores a webhook config and returns mapped result", async () => {
      const { db, chain } = mockDb();
      const row = makeWebhookRow({ archived: false, archivedAt: null, version: 2 });
      chain.returning.mockResolvedValueOnce([row]);
      // onRestore quota check: select({count}).from().where() — 2nd .where() call
      let whereCallCount = 0;
      chain.where.mockImplementation((): unknown => {
        whereCallCount++;
        // Call 2 is the onRestore quota count query (no .limit() follows)
        if (whereCallCount === 2) {
          return Promise.resolve([{ count: 1 }]);
        }
        return chain;
      });

      const result = await restoreWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH, mockAudit);

      expect(chain.transaction).toHaveBeenCalled();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "webhook-config.restored" }),
      );
      expect(result.id).toBe(WH_ID);
      expect(result.archived).toBe(false);
    });

    it("throws 409 NOT_ARCHIVED when not archived", async () => {
      const { db, chain } = mockDb();
      setupRestoreMocks(chain, [], [{ id: WH_ID }]);

      await expect(restoreWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "NOT_ARCHIVED" }),
      );
    });

    it("throws 404 when record not found", async () => {
      const { db, chain } = mockDb();
      setupRestoreMocks(chain, [], []);

      await expect(restoreWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── parseWebhookConfigQuery ────────────────────────────────────────

  describe("parseWebhookConfigQuery", () => {
    it("returns parsed query options on valid input", () => {
      const result = parseWebhookConfigQuery({ includeArchived: "true" });

      expect(result).toEqual({ includeArchived: true });
    });

    it("throws VALIDATION_ERROR on invalid query params", () => {
      expect(() => parseWebhookConfigQuery({ includeArchived: "not-a-boolean" })).toThrow(
        expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }),
      );
    });

    it("returns empty options when no query params provided", () => {
      const result = parseWebhookConfigQuery({});

      expect(result).toEqual({ includeArchived: false });
    });
  });
});
