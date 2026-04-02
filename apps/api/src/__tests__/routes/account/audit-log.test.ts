import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/audit-log-query.service.js", () => ({
  queryAuditLog: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { queryAuditLog } = await import("../../../services/audit-log-query.service.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { accountRoutes } = await import("../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const EMPTY_PAGE = { data: [], nextCursor: null, hasMore: false, totalCount: null };

const MOCK_ENTRY = {
  id: "al_550e8400-e29b-41d4-a716-446655440000" as never,
  eventType: "member.created",
  timestamp: 1000 as never,
  actor: { kind: "account", id: "acct_test" },
  detail: "Created member",
  ipAddress: "127.0.0.1",
  userAgent: "test",
  systemId: "sys_test",
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /account/audit-log", () => {
  beforeEach(() => {
    vi.mocked(queryAuditLog).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Successful query ──────────────────────────────────────────

  it("returns 200 with paginated audit log entries", async () => {
    const page = {
      data: [MOCK_ENTRY],
      nextCursor: "cursor_abc" as never,
      hasMore: true,
      totalCount: null,
    };
    vi.mocked(queryAuditLog).mockResolvedValueOnce(page);

    const res = await createApp().request("/account/audit-log");

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof page;
    expect(body.data).toHaveLength(1);
    expect((body.data[0] as Record<string, unknown>).id).toBe(MOCK_ENTRY.id);
    expect((body.data[0] as Record<string, unknown>).eventType).toBe("member.created");
    expect((body.data[0] as Record<string, unknown>).detail).toBe("Created member");
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBe("cursor_abc");
  });

  it("returns 200 with empty results when no entries match", async () => {
    vi.mocked(queryAuditLog).mockResolvedValueOnce(EMPTY_PAGE);

    const res = await createApp().request("/account/audit-log");

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof EMPTY_PAGE;
    expect(body.data).toHaveLength(0);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
  });

  // ── event_type filter ─────────────────────────────────────────

  it("forwards event_type filter to service", async () => {
    vi.mocked(queryAuditLog).mockResolvedValueOnce(EMPTY_PAGE);

    const res = await createApp().request("/account/audit-log?event_type=member.created");

    expect(res.status).toBe(200);
    expect(vi.mocked(queryAuditLog)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      expect.objectContaining({ eventType: "member.created" }),
    );
  });

  // ── resourceType filter (B-2) ─────────────────────────────────

  it("forwards resource_type filter to service", async () => {
    vi.mocked(queryAuditLog).mockResolvedValueOnce(EMPTY_PAGE);

    const res = await createApp().request("/account/audit-log?resource_type=member");

    expect(res.status).toBe(200);
    expect(vi.mocked(queryAuditLog)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      expect.objectContaining({ resourceType: "member" }),
    );
  });

  it("accepts hyphenated resource_type values", async () => {
    vi.mocked(queryAuditLog).mockResolvedValueOnce(EMPTY_PAGE);

    const res = await createApp().request("/account/audit-log?resource_type=custom-front");

    expect(res.status).toBe(200);
    expect(vi.mocked(queryAuditLog)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      expect.objectContaining({ resourceType: "custom-front" }),
    );
  });

  it("returns 400 for resource_type with invalid characters", async () => {
    const res = await createApp().request("/account/audit-log?resource_type=MEMBER");

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for resource_type starting with a digit", async () => {
    const res = await createApp().request("/account/audit-log?resource_type=1member");

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  // ── Date range defaults ───────────────────────────────────────

  it("applies default date range when from/to omitted", async () => {
    vi.mocked(queryAuditLog).mockResolvedValueOnce(EMPTY_PAGE);

    const before = Date.now();
    await createApp().request("/account/audit-log");
    const after = Date.now();

    const callArgs = vi.mocked(queryAuditLog).mock.calls[0] as unknown[];
    const params = callArgs[2] as { from: number; to: number };

    // 'to' should be approximately now
    expect(params.to).toBeGreaterThanOrEqual(before);
    expect(params.to).toBeLessThanOrEqual(after);

    // 'from' should be 'to' minus maxQueryRangeDays (90 days)
    const MS_PER_DAY = 86_400_000;
    const expectedRange = 90 * MS_PER_DAY;
    expect(params.to - params.from).toBe(expectedRange);
  });

  // ── Validation errors ─────────────────────────────────────────

  it("returns 400 when to < from", async () => {
    const res = await createApp().request("/account/audit-log?from=2000&to=1000");

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when query range exceeds max allowed days", async () => {
    const MS_PER_DAY = 86_400_000;
    const from = 1_000_000;
    const to = from + 91 * MS_PER_DAY; // 91 days > 90 day max

    const res = await createApp().request(
      `/account/audit-log?from=${String(from)}&to=${String(to)}`,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when limit exceeds maximum", async () => {
    const res = await createApp().request("/account/audit-log?limit=999");

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when limit is zero", async () => {
    const res = await createApp().request("/account/audit-log?limit=0");

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when from is negative", async () => {
    const res = await createApp().request("/account/audit-log?from=-1");

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  // ── Pagination ────────────────────────────────────────────────

  it("forwards pagination cursor and limit to service", async () => {
    vi.mocked(queryAuditLog).mockResolvedValueOnce(EMPTY_PAGE);

    const res = await createApp().request("/account/audit-log?cursor=abc123&limit=10");

    expect(res.status).toBe(200);
    expect(vi.mocked(queryAuditLog)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      expect.objectContaining({ cursor: "abc123", limit: 10 }),
    );
  });

  it("uses default limit of 25 when not specified", async () => {
    vi.mocked(queryAuditLog).mockResolvedValueOnce(EMPTY_PAGE);

    await createApp().request("/account/audit-log");

    expect(vi.mocked(queryAuditLog)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      expect.objectContaining({ limit: 25 }),
    );
  });

  // ── Rate limiting (S-11) ──────────────────────────────────────

  it("applies the auditQuery rate limit category", () => {
    // The route module calls createCategoryRateLimiter during initialization.
    // Verify it was called with the dedicated "auditQuery" category.
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("auditQuery");
  });

  // ── Combined filters ──────────────────────────────────────────

  it("forwards both event_type and resource_type when provided", async () => {
    vi.mocked(queryAuditLog).mockResolvedValueOnce(EMPTY_PAGE);

    const res = await createApp().request(
      "/account/audit-log?event_type=member.created&resource_type=member",
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(queryAuditLog)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      expect.objectContaining({ eventType: "member.created", resourceType: "member" }),
    );
  });

  it("forwards explicit from/to timestamps to service", async () => {
    vi.mocked(queryAuditLog).mockResolvedValueOnce(EMPTY_PAGE);

    const res = await createApp().request("/account/audit-log?from=1000&to=2000");

    expect(res.status).toBe(200);
    expect(vi.mocked(queryAuditLog)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      expect.objectContaining({ from: 1000, to: 2000 }),
    );
  });
});
