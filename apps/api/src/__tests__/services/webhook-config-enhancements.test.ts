import { brandId } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import { WEBHOOK_SECRET_BYTES } from "../../service.constants.js";
import { asDb } from "../helpers/mock-db.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { SystemId, WebhookId } from "@pluralscape/types";

// -- Mocks ----------------------------------------------------------------

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/ip-validation.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ip-validation.js")>();
  return {
    ...actual,
    resolveAndValidateUrl: vi.fn().mockResolvedValue(["93.184.216.34"]),
  };
});

vi.mock("../../lib/rls-context.js", () => ({
  withTenantTransaction: vi
    .fn()
    .mockImplementation((_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn(_db),
    ),
  withTenantRead: vi
    .fn()
    .mockImplementation((_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn(_db),
    ),
}));

vi.mock("../../lib/tenant-context.js", () => ({
  tenantCtx: vi.fn().mockReturnValue({}),
}));

vi.mock("../../services/webhook-dispatcher.js", () => ({
  invalidateWebhookConfigCache: vi.fn(),
}));

vi.mock("../../lib/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// -- Imports after mocks --------------------------------------------------

const { invalidateWebhookConfigCache } = await import("../../services/webhook-dispatcher.js");
const { rotateWebhookSecret } = await import("../../services/webhook-config/update.js");
const { testWebhookConfig } = await import("../../services/webhook-config/test.js");

// -- Fixtures -------------------------------------------------------------

const SYS_ID = brandId<SystemId>("sys_550e8400-e29b-41d4-a716-446655440000");
const WH_ID = brandId<WebhookId>("wh_550e8400-e29b-41d4-a716-446655440001");

const AUTH = makeTestAuth({ systemId: SYS_ID });

const mockAudit: AuditWriter = vi.fn();

const NOW = 1_700_000_000;

function makeConfigRow(overrides?: Record<string, unknown>) {
  return {
    id: WH_ID,
    systemId: SYS_ID,
    url: "https://example.com/webhook",
    eventTypes: ["member.created"],
    enabled: true,
    cryptoKeyId: null,
    version: 2,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeRotateMockTx(overrides?: Record<string, unknown>) {
  const row = makeConfigRow(overrides);
  return {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([row]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: WH_ID }]),
  };
}

function makeTestConfigRow() {
  return {
    id: WH_ID,
    systemId: SYS_ID,
    url: "https://example.com/webhook",
    secret: Buffer.from("test-secret-key").toString("base64"),
    enabled: true,
    archived: false,
  };
}

function makeReadMockTx(rows: Record<string, unknown>[]) {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

// -- rotateWebhookSecret --------------------------------------------------

describe("rotateWebhookSecret", () => {
  it("generates a new secret and returns it as base64", async () => {
    const mockTx = makeRotateMockTx();

    const result = await rotateWebhookSecret(
      asDb(mockTx),
      SYS_ID,
      WH_ID,
      { version: 1 },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(WH_ID);
    expect(typeof result.secret).toBe("string");
    expect(result.version).toBe(2);
  });

  it("invalidates the webhook config cache", async () => {
    const mockTx = makeRotateMockTx();

    await rotateWebhookSecret(asDb(mockTx), SYS_ID, WH_ID, { version: 1 }, AUTH, mockAudit);

    expect(invalidateWebhookConfigCache).toHaveBeenCalledWith(SYS_ID);
  });

  it("writes an audit log entry", async () => {
    const mockTx = makeRotateMockTx();
    const audit: AuditWriter = vi.fn();

    await rotateWebhookSecret(asDb(mockTx), SYS_ID, WH_ID, { version: 1 }, AUTH, audit);

    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: "webhook-config.secret-rotated",
      }),
    );
  });

  it("rejects invalid params (missing version)", async () => {
    const mockTx = makeReadMockTx([]);

    await expect(
      rotateWebhookSecret(asDb(mockTx), SYS_ID, WH_ID, {}, AUTH, mockAudit),
    ).rejects.toThrow("Invalid payload");
  });

  it("generates a secret of the correct byte length", async () => {
    const mockTx = makeRotateMockTx();

    const result = await rotateWebhookSecret(
      asDb(mockTx),
      SYS_ID,
      WH_ID,
      { version: 1 },
      AUTH,
      mockAudit,
    );
    const decoded = Buffer.from(result.secret, "base64");
    expect(decoded.length).toBe(WEBHOOK_SECRET_BYTES);
  });
});

// -- testWebhookConfig ----------------------------------------------------

describe("testWebhookConfig", () => {
  it("sends a synthetic ping payload and returns success result", async () => {
    const mockTx = makeReadMockTx([makeTestConfigRow()]);
    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

    const result = await testWebhookConfig(asDb(mockTx), SYS_ID, WH_ID, AUTH, mockFetch);

    expect(result.success).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns failure result on non-2xx response", async () => {
    const mockTx = makeReadMockTx([makeTestConfigRow()]);
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response("Internal Server Error", { status: 500 }));

    const result = await testWebhookConfig(asDb(mockTx), SYS_ID, WH_ID, AUTH, mockFetch);

    expect(result.success).toBe(false);
    expect(result.httpStatus).toBe(500);
  });

  it("returns failure result on network error", async () => {
    const mockTx = makeReadMockTx([makeTestConfigRow()]);
    const mockFetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const result = await testWebhookConfig(asDb(mockTx), SYS_ID, WH_ID, AUTH, mockFetch);

    expect(result.success).toBe(false);
    expect(result.httpStatus).toBeNull();
    expect(typeof result.error).toBe("string");
  });

  it("throws NOT_FOUND when config does not exist", async () => {
    const mockTx = makeReadMockTx([]);

    await expect(testWebhookConfig(asDb(mockTx), SYS_ID, WH_ID, AUTH)).rejects.toThrow(
      "Webhook config not found",
    );
  });

  it("does not include systemId or webhookId in the test payload", async () => {
    const mockTx = makeReadMockTx([makeTestConfigRow()]);
    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

    await testWebhookConfig(asDb(mockTx), SYS_ID, WH_ID, AUTH, mockFetch);

    const call = mockFetch.mock.calls[0] ?? [];
    const options = call[1] as RequestInit;
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty("systemId");
    expect(body).not.toHaveProperty("webhookId");
    expect(body).toHaveProperty("event", "webhook.test");
    expect(body).toHaveProperty("timestamp");
  });

  it("includes signature and timestamp headers in the request", async () => {
    const mockTx = makeReadMockTx([makeTestConfigRow()]);
    const mockFetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

    await testWebhookConfig(asDb(mockTx), SYS_ID, WH_ID, AUTH, mockFetch);

    const call = mockFetch.mock.calls[0] ?? [];
    const options = call[1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers["X-Pluralscape-Signature"]).toMatch(/^[0-9a-f]{64}$/);
    expect(headers["X-Pluralscape-Timestamp"]).toMatch(/^\d+$/);
  });
});
