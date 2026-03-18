import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/group.service.js", () => ({
  copyGroup: vi.fn(),
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
  ownedSystemIds: new Set([
    "sys_550e8400-e29b-41d4-a716-446655440000" as AuthContext["systemId"] & string,
  ]),
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

const { copyGroup } = await import("../../../services/group.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const GROUP_ID = "grp_550e8400-e29b-41d4-a716-446655440000";
const SYS_URL = `/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups/${GROUP_ID}/copy`;

async function postJSON(app: Hono, body: unknown): Promise<Response> {
  return app.request(SYS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/groups/:groupId/copy", () => {
  beforeEach(() => {
    vi.mocked(copyGroup).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with copied group on success", async () => {
    vi.mocked(copyGroup).mockResolvedValueOnce({
      id: "grp_copy" as never,
      systemId: MOCK_AUTH.systemId as never,
      parentGroupId: null,
      sortOrder: 1,
      encryptedData: "dGVzdA==",
      version: 1,
      createdAt: 1000 as never,
      updatedAt: 1000 as never,
      archived: false,
      archivedAt: null,
    });

    const app = createApp();
    const res = await postJSON(app, { copyMemberships: true });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("grp_copy");
  });

  it("returns 404 when source group not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(copyGroup).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Source group not found"),
    );

    const app = createApp();
    const res = await postJSON(app, {});

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(SYS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
