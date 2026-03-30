import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/system.service.js", () => ({
  getSystemProfile: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { getSystemProfile } = await import("../../../services/system.service.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:id", () => {
  beforeEach(() => {
    vi.mocked(getSystemProfile).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with system profile", async () => {
    vi.mocked(getSystemProfile).mockResolvedValueOnce({
      id: "sys_550e8400-e29b-41d4-a716-446655440000" as never,
      encryptedData: "dGVzdA==",
      version: 1,
      createdAt: 1000 as never,
      updatedAt: 1000 as never,
    });

    const app = createApp();
    const res = await app.request("/systems/sys_550e8400-e29b-41d4-a716-446655440000");

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { id: string; encryptedData: string; version: number };
    };
    expect(body.data.id).toBe("sys_550e8400-e29b-41d4-a716-446655440000");
    expect(body.data.encryptedData).toBe("dGVzdA==");
    expect(body.data.version).toBe(1);
  });

  it("forwards systemId and auth to service", async () => {
    vi.mocked(getSystemProfile).mockResolvedValueOnce({
      id: "sys_550e8400-e29b-41d4-a716-446655440000" as never,
      encryptedData: null,
      version: 1,
      createdAt: 1000 as never,
      updatedAt: 1000 as never,
    });

    const app = createApp();
    await app.request("/systems/sys_550e8400-e29b-41d4-a716-446655440000");

    expect(vi.mocked(getSystemProfile)).toHaveBeenCalledWith(
      expect.anything(),
      "sys_550e8400-e29b-41d4-a716-446655440000",
      MOCK_AUTH,
    );
  });

  it("returns 404 when system not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(getSystemProfile).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "System not found"),
    );

    const app = createApp();
    const res = await app.request("/systems/sys_660e8400-e29b-41d4-a716-446655440000");

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid system ID format", async () => {
    const app = createApp();
    const res = await app.request("/systems/not-a-valid-id");

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(getSystemProfile).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request("/systems/sys_550e8400-e29b-41d4-a716-446655440000");

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
