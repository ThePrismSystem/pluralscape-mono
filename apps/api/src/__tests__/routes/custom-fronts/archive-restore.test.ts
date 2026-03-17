import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

vi.mock("../../../services/custom-front.service.js", () => ({
  archiveCustomFront: vi.fn(),
  restoreCustomFront: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));
vi.mock("../../../lib/db.js", () => ({ getDb: vi.fn().mockResolvedValue({}) }));
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

const { archiveCustomFront, restoreCustomFront } =
  await import("../../../services/custom-front.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const ARCHIVE_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/custom-fronts/cf_660e8400-e29b-41d4-a716-446655440000/archive";
const RESTORE_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/custom-fronts/cf_660e8400-e29b-41d4-a716-446655440000/restore";

describe("POST /systems/:id/custom-fronts/:customFrontId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveCustomFront).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with ok: true", async () => {
    vi.mocked(archiveCustomFront).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveCustomFront).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Custom front not found"),
    );

    const app = createApp();
    const res = await app.request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("POST /systems/:id/custom-fronts/:customFrontId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreCustomFront).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored custom front", async () => {
    vi.mocked(restoreCustomFront).mockResolvedValueOnce({
      id: "cf_660e8400-e29b-41d4-a716-446655440000" as never,
      systemId: MOCK_AUTH.systemId as never,
      encryptedData: "dGVzdA==",
      version: 2,
      archived: false,
      archivedAt: null,
      createdAt: 1000 as never,
      updatedAt: 2000 as never,
    });

    const app = createApp();
    const res = await app.request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(2);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(restoreCustomFront).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Archived custom front not found"),
    );

    const app = createApp();
    const res = await app.request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
