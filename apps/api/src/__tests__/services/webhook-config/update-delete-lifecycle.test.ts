import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";

import { AUTH, SYSTEM_ID, WH_ID, makeWebhookRow } from "./internal.js";

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
  const { createCryptoMock } = await import("../../helpers/mock-crypto.js");
  return createCryptoMock();
});

vi.mock("../../../lib/audit-log.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../../lib/ip-validation.js", () => ({
  resolveAndValidateUrl: vi.fn().mockResolvedValue(["93.184.216.34"]),
}));

vi.mock("../../../env.js", () => ({
  env: { NODE_ENV: "development", LOG_LEVEL: "warn" },
}));

// ── Import under test ────────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../../lib/system-ownership.js");
const { updateWebhookConfig } = await import("../../../services/webhook-config/update.js");
const { deleteWebhookConfig, archiveWebhookConfig, restoreWebhookConfig } = await import(
  "../../../services/webhook-config/lifecycle.js"
);
const { parseWebhookConfigQuery } = await import("../../../services/webhook-config/queries.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

// ── Tests ────────────────────────────────────────────────────────────

describe("updateWebhookConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

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
      updateWebhookConfig(
        db,
        brandId<SystemId>("sys_other"),
        WH_ID,
        { version: 1 },
        AUTH,
        mockAudit,
      ),
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

describe("deleteWebhookConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

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
        brandId<WebhookId>("wh_00000000-0000-4000-a000-000000000099"),
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
      deleteWebhookConfig(db, brandId<SystemId>("sys_other"), WH_ID, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("calls .for('update') on the existence check query to prevent race conditions", async () => {
    const { db, chain } = mockDb();
    setupDeleteMocks(chain, [{ id: WH_ID }], [{ count: 0 }]);

    await deleteWebhookConfig(db, SYSTEM_ID, WH_ID, AUTH, mockAudit);

    expect(chain.for).toHaveBeenCalledWith("update");
  });
});

describe("archiveWebhookConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

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

describe("restoreWebhookConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

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
