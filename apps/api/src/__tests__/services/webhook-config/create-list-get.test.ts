import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { captureWhereArg, mockDb } from "../../helpers/mock-db.js";
import { mockOwnershipFailure } from "../../helpers/mock-ownership.js";

import { AUTH, SYSTEM_ID, WH_ID, makeWebhookRow } from "./internal.js";

import type { SystemId, WebhookEventType, WebhookId } from "@pluralscape/types";

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
const { createWebhookConfig } = await import("../../../services/webhook-config/create.js");
const { listWebhookConfigs, getWebhookConfig } = await import(
  "../../../services/webhook-config/queries.js"
);

// ── Fixtures ─────────────────────────────────────────────────────────

const mockAudit = vi.fn().mockResolvedValue(undefined);

const validCreatePayload: {
  url: string;
  eventTypes: WebhookEventType[];
  enabled: boolean;
  cryptoKeyId: undefined;
} = {
  url: "https://example.com/webhook",
  eventTypes: ["member.created"],
  enabled: true,
  cryptoKeyId: undefined,
};

// ── Tests ────────────────────────────────────────────────────────────

describe("createWebhookConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

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
    expect(typeof result.secret).toBe("string");
    expect(mockAudit).toHaveBeenCalledOnce();
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
      createWebhookConfig(
        db,
        brandId<SystemId>("sys_other"),
        validCreatePayload,
        AUTH,
        mockAudit,
      ),
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
      { ...validCreatePayload },
      AUTH,
      mockAudit,
    );
    expect(result.cryptoKeyId).toBeNull();
  });
});

describe("listWebhookConfigs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

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
    expect(whereArg).not.toBeUndefined();
  });

  it("includes archived configs when includeArchived is true", async () => {
    const { db, chain } = mockDb();
    callListWithFilter(chain);

    await listWebhookConfigs(db, SYSTEM_ID, AUTH, { includeArchived: true });

    const whereArg = captureWhereArg(chain);
    expect(whereArg).not.toBeUndefined();
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

    await expect(listWebhookConfigs(db, brandId<SystemId>("sys_other"), AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

describe("getWebhookConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
        brandId<WebhookId>("wh_00000000-0000-4000-a000-000000000099"),
        AUTH,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws 404 when system ownership check fails", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(
      getWebhookConfig(db, brandId<SystemId>("sys_other"), WH_ID, AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
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
      brandId<WebhookId>("wh_00000000-0000-4000-a000-000000000010"),
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
