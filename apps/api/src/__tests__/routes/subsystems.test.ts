import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../middleware/request-id.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../services/subsystem.service.js", () => ({
  createSubsystem: vi.fn(),
  listSubsystems: vi.fn(),
  getSubsystem: vi.fn(),
  updateSubsystem: vi.fn(),
  deleteSubsystem: vi.fn(),
  archiveSubsystem: vi.fn(),
  restoreSubsystem: vi.fn(),
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
  createSubsystem,
  listSubsystems,
  getSubsystem,
  updateSubsystem,
  deleteSubsystem,
  archiveSubsystem,
  restoreSubsystem,
} = await import("../../services/subsystem.service.js");
const { systemRoutes } = await import("../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const SUB_ID = "sub_550e8400-e29b-41d4-a716-446655440001";

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const BASE_URL = `/systems/${SYS_ID}/subsystems`;

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

const MOCK_SUBSYSTEM = {
  id: SUB_ID as never,
  systemId: SYS_ID as never,
  parentSubsystemId: null,
  architectureType: null,
  hasCore: false,
  discoveryStatus: null,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
  archived: false,
  archivedAt: null,
};

const MOCK_PAGINATED = {
  items: [MOCK_SUBSYSTEM],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

const VALID_BODY = { encryptedData: "dGVzdA==" };

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/subsystems", () => {
  beforeEach(() => vi.mocked(createSubsystem).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 201 on success", async () => {
    vi.mocked(createSubsystem).mockResolvedValueOnce(MOCK_SUBSYSTEM);
    const app = createApp();
    const res = await postJSON(app, BASE_URL, VALID_BODY);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(SUB_ID);
  });

  it("forwards systemId, body, auth to service", async () => {
    vi.mocked(createSubsystem).mockResolvedValueOnce(MOCK_SUBSYSTEM);
    const app = createApp();
    await postJSON(app, BASE_URL, VALID_BODY);
    expect(vi.mocked(createSubsystem)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      VALID_BODY,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 404 when service throws NOT_FOUND", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(createSubsystem).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Not found"),
    );
    const app = createApp();
    const res = await postJSON(app, BASE_URL, VALID_BODY);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(createSubsystem).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp();
    const res = await postJSON(app, BASE_URL, VALID_BODY);
    expect(res.status).toBe(500);
  });
});

describe("GET /systems/:id/subsystems", () => {
  beforeEach(() => vi.mocked(listSubsystems).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with paginated list", async () => {
    vi.mocked(listSubsystems).mockResolvedValueOnce(MOCK_PAGINATED);
    const app = createApp();
    const res = await app.request(BASE_URL);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it("forwards systemId and auth to service", async () => {
    vi.mocked(listSubsystems).mockResolvedValueOnce(MOCK_PAGINATED);
    const app = createApp();
    await app.request(BASE_URL);
    expect(vi.mocked(listSubsystems)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      undefined,
      expect.any(Number),
    );
  });
});

describe("GET /systems/:id/subsystems/:subsystemId", () => {
  beforeEach(() => vi.mocked(getSubsystem).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with subsystem", async () => {
    vi.mocked(getSubsystem).mockResolvedValueOnce(MOCK_SUBSYSTEM);
    const app = createApp();
    const res = await app.request(`${BASE_URL}/${SUB_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(SUB_ID);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(getSubsystem).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Subsystem not found"),
    );
    const app = createApp();
    const res = await app.request(`${BASE_URL}/${SUB_ID}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("PUT /systems/:id/subsystems/:subsystemId", () => {
  beforeEach(() => vi.mocked(updateSubsystem).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 on success", async () => {
    vi.mocked(updateSubsystem).mockResolvedValueOnce({ ...MOCK_SUBSYSTEM, version: 2 });
    const app = createApp();
    const res = await putJSON(app, `${BASE_URL}/${SUB_ID}`, { ...VALID_BODY, version: 1 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(2);
  });
});

describe("DELETE /systems/:id/subsystems/:subsystemId", () => {
  beforeEach(() => vi.mocked(deleteSubsystem).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(deleteSubsystem).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(`${BASE_URL}/${SUB_ID}`, { method: "DELETE" });
    expect(res.status).toBe(204);
  });
});

describe("POST /systems/:id/subsystems/:subsystemId/archive", () => {
  beforeEach(() => vi.mocked(archiveSubsystem).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(archiveSubsystem).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await postJSON(app, `${BASE_URL}/${SUB_ID}/archive`, {});
    expect(res.status).toBe(204);
  });
});

describe("POST /systems/:id/subsystems/:subsystemId/restore", () => {
  beforeEach(() => vi.mocked(restoreSubsystem).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 on success", async () => {
    vi.mocked(restoreSubsystem).mockResolvedValueOnce(MOCK_SUBSYSTEM);
    const app = createApp();
    const res = await postJSON(app, `${BASE_URL}/${SUB_ID}/restore`, {});
    expect(res.status).toBe(200);
  });
});
