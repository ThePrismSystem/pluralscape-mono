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

vi.mock("../../../services/custom-front.service.js", () => ({
  createCustomFront: vi.fn(),
  listCustomFronts: vi.fn(),
  getCustomFront: vi.fn(),
  updateCustomFront: vi.fn(),
  deleteCustomFront: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const {
  createCustomFront,
  listCustomFronts,
  getCustomFront,
  updateCustomFront,
  deleteCustomFront,
} = await import("../../../services/custom-front.service.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/custom-fronts";
const CF_URL = `${BASE_URL}/cf_660e8400-e29b-41d4-a716-446655440000`;

const MOCK_CF = {
  id: "cf_660e8400-e29b-41d4-a716-446655440000" as never,
  systemId: MOCK_AUTH.systemId as never,
  encryptedData: "dGVzdA==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

const EMPTY_PAGE = { data: [], nextCursor: null, hasMore: false, totalCount: null };

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/custom-fronts", () => {
  beforeEach(() => {
    vi.mocked(createCustomFront).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new custom front", async () => {
    vi.mocked(createCustomFront).mockResolvedValueOnce(MOCK_CF);

    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encryptedData: "dGVzdA==" }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("cf_660e8400-e29b-41d4-a716-446655440000");
  });

  it("returns 400 for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });
});

describe("GET /systems/:id/custom-fronts", () => {
  beforeEach(() => {
    vi.mocked(listCustomFronts).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listCustomFronts).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof EMPTY_PAGE;
    expect(body.data).toEqual([]);
  });
});

describe("GET /systems/:id/custom-fronts/:customFrontId", () => {
  beforeEach(() => {
    vi.mocked(getCustomFront).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with custom front", async () => {
    vi.mocked(getCustomFront).mockResolvedValueOnce(MOCK_CF);

    const app = createApp();
    const res = await app.request(CF_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("cf_660e8400-e29b-41d4-a716-446655440000");
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(getCustomFront).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Custom front not found"),
    );

    const app = createApp();
    const res = await app.request(CF_URL);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid ID format", async () => {
    const app = createApp();
    const res = await app.request(`${BASE_URL}/not-valid`);

    expect(res.status).toBe(400);
  });
});

describe("PUT /systems/:id/custom-fronts/:customFrontId", () => {
  beforeEach(() => {
    vi.mocked(updateCustomFront).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated custom front", async () => {
    vi.mocked(updateCustomFront).mockResolvedValueOnce({ ...MOCK_CF, version: 2 });

    const app = createApp();
    const res = await app.request(CF_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encryptedData: "dGVzdA==", version: 1 }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { version: number } };
    expect(body.data.version).toBe(2);
  });

  it("returns 409 on version conflict", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(updateCustomFront).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );

    const app = createApp();
    const res = await app.request(CF_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encryptedData: "dGVzdA==", version: 1 }),
    });

    expect(res.status).toBe(409);
  });
});

describe("DELETE /systems/:id/custom-fronts/:customFrontId", () => {
  beforeEach(() => {
    vi.mocked(deleteCustomFront).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with ok: true", async () => {
    vi.mocked(deleteCustomFront).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(CF_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 409 when has dependents", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteCustomFront).mockRejectedValueOnce(
      new ApiHttpError(409, "HAS_DEPENDENTS", "Custom front has 5 fronting session(s)."),
    );

    const app = createApp();
    const res = await app.request(CF_URL, { method: "DELETE" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });
});

describe("read rate limits", () => {
  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });
});
