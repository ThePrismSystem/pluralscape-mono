import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { Context } from "hono";


// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/innerworld-entity.service.js", () => ({
  createEntity: vi.fn(),
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

const { createEntity } = await import("../../../../services/innerworld-entity.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/innerworld/entities";

const MOCK_ENTITY = {
  id: "iwe_660e8400-e29b-41d4-a716-446655440000" as never,
  systemId: MOCK_AUTH.systemId as never,
  regionId: "iwr_test" as never,
  encryptedData: "dGVzdA==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/innerworld/entities", () => {
  beforeEach(() => {
    vi.mocked(createEntity).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new entity", async () => {
    vi.mocked(createEntity).mockResolvedValueOnce(MOCK_ENTITY);

    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Entity" }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as typeof MOCK_ENTITY;
    expect(body.id).toBe("iwe_660e8400-e29b-41d4-a716-446655440000");
    expect(body.version).toBe(1);
    expect(body.archived).toBe(false);
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for empty object body", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(createEntity).mockRejectedValueOnce(
      new ApiHttpError(400, "VALIDATION_ERROR", "Missing required fields"),
    );
    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });
});
