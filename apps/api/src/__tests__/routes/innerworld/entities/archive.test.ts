import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/innerworld-entity.service.js", () => ({
  archiveEntity: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock("../../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: Context, next: () => Promise<void>) => {
      await next();
    }),
}));

vi.mock("../../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { archiveEntity } = await import("../../../../services/innerworld-entity.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/innerworld/entities";
const ARCHIVE_URL = `${BASE_URL}/iwe_660e8400-e29b-41d4-a716-446655440000/archive`;

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/innerworld/entities/:entityId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveEntity).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 No Content", async () => {
    vi.mocked(archiveEntity).mockResolvedValueOnce(undefined);

    const res = await createApp().request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(archiveEntity).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Entity not found"),
    );

    const res = await createApp().request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
