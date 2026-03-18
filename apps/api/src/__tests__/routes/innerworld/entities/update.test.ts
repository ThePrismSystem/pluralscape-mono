import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";


// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/innerworld-entity.service.js", () => ({
  updateEntity: vi.fn(),
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

const { updateEntity } = await import("../../../../services/innerworld-entity.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/innerworld/entities";
const ENTITY_URL = `${BASE_URL}/iwe_660e8400-e29b-41d4-a716-446655440000`;

const MOCK_ENTITY = {
  id: "iwe_660e8400-e29b-41d4-a716-446655440000" as never,
  systemId: MOCK_AUTH.systemId as never,
  regionId: "iwr_test" as never,
  encryptedData: "dGVzdA==",
  version: 2,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 2000 as never,
};

const VALID_BODY = { encryptedData: "dXBkYXRlZA==" };

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /systems/:id/innerworld/entities/:entityId", () => {
  beforeEach(() => {
    vi.mocked(updateEntity).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated entity", async () => {
    vi.mocked(updateEntity).mockResolvedValueOnce(MOCK_ENTITY);

    const res = await createApp().request(ENTITY_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_ENTITY;
    expect(body.id).toBe("iwe_660e8400-e29b-41d4-a716-446655440000");
    expect(body.version).toBe(2);
    expect(body.updatedAt).toBe(2000);
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await createApp().request(ENTITY_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for empty object body", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(updateEntity).mockRejectedValueOnce(
      new ApiHttpError(400, "VALIDATION_ERROR", "Missing required fields"),
    );
    const res = await createApp().request(ENTITY_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(updateEntity).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Entity not found"),
    );

    const res = await createApp().request(ENTITY_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Entity" }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when version conflicts", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(updateEntity).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version mismatch"),
    );
    const res = await createApp().request(ENTITY_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });
});
