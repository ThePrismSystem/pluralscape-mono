import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../middleware/request-id.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../services/relationship.service.js", () => ({
  createRelationship: vi.fn(),
  listRelationships: vi.fn(),
  getRelationship: vi.fn(),
  updateRelationship: vi.fn(),
  deleteRelationship: vi.fn(),
  archiveRelationship: vi.fn(),
  restoreRelationship: vi.fn(),
}));

vi.mock("../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock("../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../middleware/rate-limit.js", () => ({
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
  ownedSystemIds: new Set([
    "sys_550e8400-e29b-41d4-a716-446655440000" as AuthContext["systemId"] & string,
  ]),
};

vi.mock("../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const {
  createRelationship,
  listRelationships,
  getRelationship,
  updateRelationship,
  deleteRelationship,
  archiveRelationship,
  restoreRelationship,
} = await import("../../services/relationship.service.js");
const { systemRoutes } = await import("../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const REL_ID = "rel_550e8400-e29b-41d4-a716-446655440001";

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const BASE_URL = `/systems/${SYS_ID}/relationships`;

async function postJSON(app: Hono, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function putJSON(app: Hono, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_RELATIONSHIP = {
  id: REL_ID as never,
  systemId: SYS_ID as never,
  sourceMemberId: "mem_00000000-0000-0000-0000-000000000001",
  targetMemberId: "mem_00000000-0000-0000-0000-000000000002",
  type: "partner",
  bidirectional: true,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
  archived: false,
  archivedAt: null,
};

const MOCK_PAGINATED = {
  items: [MOCK_RELATIONSHIP],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

const VALID_BODY = { encryptedData: "dGVzdA==" };

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/relationships", () => {
  beforeEach(() => vi.mocked(createRelationship).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 201 on success", async () => {
    vi.mocked(createRelationship).mockResolvedValueOnce(MOCK_RELATIONSHIP);
    const app = createApp();
    const res = await postJSON(app, BASE_URL, VALID_BODY);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(REL_ID);
  });

  it("forwards systemId, body, auth to service", async () => {
    vi.mocked(createRelationship).mockResolvedValueOnce(MOCK_RELATIONSHIP);
    const app = createApp();
    await postJSON(app, BASE_URL, VALID_BODY);
    expect(vi.mocked(createRelationship)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      VALID_BODY,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 404 when service throws NOT_FOUND", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(createRelationship).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Not found"),
    );
    const app = createApp();
    const res = await postJSON(app, BASE_URL, VALID_BODY);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(createRelationship).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp();
    const res = await postJSON(app, BASE_URL, VALID_BODY);
    expect(res.status).toBe(500);
  });
});

describe("GET /systems/:id/relationships", () => {
  beforeEach(() => vi.mocked(listRelationships).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with paginated list", async () => {
    vi.mocked(listRelationships).mockResolvedValueOnce(MOCK_PAGINATED);
    const app = createApp();
    const res = await app.request(BASE_URL);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it("forwards systemId and auth to service", async () => {
    vi.mocked(listRelationships).mockResolvedValueOnce(MOCK_PAGINATED);
    const app = createApp();
    await app.request(BASE_URL);
    expect(vi.mocked(listRelationships)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      undefined,
      expect.any(Number),
      undefined,
    );
  });
});

describe("GET /systems/:id/relationships/:relationshipId", () => {
  beforeEach(() => vi.mocked(getRelationship).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with relationship", async () => {
    vi.mocked(getRelationship).mockResolvedValueOnce(MOCK_RELATIONSHIP);
    const app = createApp();
    const res = await app.request(`${BASE_URL}/${REL_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(REL_ID);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(getRelationship).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Relationship not found"),
    );
    const app = createApp();
    const res = await app.request(`${BASE_URL}/${REL_ID}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("PUT /systems/:id/relationships/:relationshipId", () => {
  beforeEach(() => vi.mocked(updateRelationship).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 on success", async () => {
    vi.mocked(updateRelationship).mockResolvedValueOnce({ ...MOCK_RELATIONSHIP, version: 2 });
    const app = createApp();
    const res = await putJSON(app, `${BASE_URL}/${REL_ID}`, { ...VALID_BODY, version: 1 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(2);
  });
});

describe("DELETE /systems/:id/relationships/:relationshipId", () => {
  beforeEach(() => vi.mocked(deleteRelationship).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(deleteRelationship).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(`${BASE_URL}/${REL_ID}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });
});

describe("POST /systems/:id/relationships/:relationshipId/archive", () => {
  beforeEach(() => vi.mocked(archiveRelationship).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(archiveRelationship).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await postJSON(app, `${BASE_URL}/${REL_ID}/archive`, {});
    expect(res.status).toBe(204);
  });
});

describe("POST /systems/:id/relationships/:relationshipId/restore", () => {
  beforeEach(() => vi.mocked(restoreRelationship).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 on success", async () => {
    vi.mocked(restoreRelationship).mockResolvedValueOnce(MOCK_RELATIONSHIP);
    const app = createApp();
    const res = await postJSON(app, `${BASE_URL}/${REL_ID}/restore`, {});
    expect(res.status).toBe(200);
  });
});
