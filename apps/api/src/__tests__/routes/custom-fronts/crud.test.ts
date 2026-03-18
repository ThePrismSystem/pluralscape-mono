import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/custom-front.service.js", () => ({
  createCustomFront: vi.fn(),
  listCustomFronts: vi.fn(),
  getCustomFront: vi.fn(),
  updateCustomFront: vi.fn(),
  deleteCustomFront: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: Context, next: () => Promise<void>) => {
      await next();
    }),
}));

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_550e8400-e29b-41d4-a716-446655440000" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
};

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const {
  createCustomFront,
  listCustomFronts,
  getCustomFront,
  updateCustomFront,
  deleteCustomFront,
} = await import("../../../services/custom-front.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

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

const EMPTY_PAGE = { items: [], nextCursor: null, hasMore: false, totalCount: null };

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
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("cf_660e8400-e29b-41d4-a716-446655440000");
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
    expect(body.items).toEqual([]);
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
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("cf_660e8400-e29b-41d4-a716-446655440000");
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
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(2);
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
