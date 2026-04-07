import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/innerworld-canvas.service.js", () => ({
  getCanvas: vi.fn(),
  upsertCanvas: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { getCanvas, upsertCanvas } =
  await import("../../../../services/innerworld-canvas.service.js");
const { createCategoryRateLimiter } = await import("../../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/innerworld/canvas";

const MOCK_CANVAS = {
  id: "iwc_660e8400-e29b-41d4-a716-446655440000" as never,
  systemId: MOCK_AUTH.systemId as never,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

const VALID_BODY = { data: { nodes: [], edges: [] } };

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:id/innerworld/canvas", () => {
  beforeEach(() => {
    vi.mocked(getCanvas).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with canvas data", async () => {
    vi.mocked(getCanvas).mockResolvedValueOnce(MOCK_CANVAS);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_CANVAS };
    expect(body.data.id).toBe("iwc_660e8400-e29b-41d4-a716-446655440000");
    expect(body.data.encryptedData).toBe("dGVzdA==");
  });

  it("returns 404 when canvas not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(getCanvas).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Canvas not found"),
    );
    const res = await createApp().request(BASE_URL);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("PUT /systems/:id/innerworld/canvas", () => {
  beforeEach(() => {
    vi.mocked(upsertCanvas).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with upserted canvas", async () => {
    vi.mocked(upsertCanvas).mockResolvedValueOnce(MOCK_CANVAS);

    const res = await createApp().request(BASE_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_CANVAS };
    expect(body.data.id).toBe("iwc_660e8400-e29b-41d4-a716-446655440000");
    expect(body.data.version).toBe(1);
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await createApp().request(BASE_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for empty object body", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(upsertCanvas).mockRejectedValueOnce(
      new ApiHttpError(400, "VALIDATION_ERROR", "Missing required fields"),
    );
    const res = await createApp().request(BASE_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });

  it("returns 409 when version conflicts", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(upsertCanvas).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version mismatch"),
    );
    const res = await createApp().request(BASE_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });
});

describe("read rate limit", () => {
  it("applies the readDefault rate limit category to the canvas GET route", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });
});
