import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../../middleware/request-id.js";

import type { AuthContext } from "../../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/member-photo.service.js", () => ({
  listMemberPhotos: vi.fn(),
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

vi.mock("../../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_test" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set(["sys_test" as AuthContext["systemId"] & string]),
};

vi.mock("../../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { listMemberPhotos } = await import("../../../../services/member-photo.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const MEM_ID = "mem_550e8400-e29b-41d4-a716-446655440000";
const PHOTO_ID = "mp_550e8400-e29b-41d4-a716-446655440000";

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const PHOTO_RESULT = {
  id: PHOTO_ID as never,
  memberId: MEM_ID as never,
  systemId: SYS_ID as never,
  sortOrder: 0,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
  archived: false,
  archivedAt: null,
};

const PHOTOS_PATH = `/systems/${SYS_ID}/members/${MEM_ID}/photos`;

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/members/:memberId/photos", () => {
  beforeEach(() => {
    vi.mocked(listMemberPhotos).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with items array on success", async () => {
    vi.mocked(listMemberPhotos).mockResolvedValueOnce([PHOTO_RESULT]);

    const app = createApp();
    const res = await app.request(PHOTOS_PATH);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: (typeof PHOTO_RESULT)[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe(PHOTO_ID);
    expect(body.items[0]?.memberId).toBe(MEM_ID);
  });

  it("returns 200 with empty items array when no photos", async () => {
    vi.mocked(listMemberPhotos).mockResolvedValueOnce([]);

    const app = createApp();
    const res = await app.request(PHOTOS_PATH);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  it("forwards systemId, memberId, and auth to service", async () => {
    vi.mocked(listMemberPhotos).mockResolvedValueOnce([PHOTO_RESULT]);

    const app = createApp();
    await app.request(PHOTOS_PATH);

    expect(vi.mocked(listMemberPhotos)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MEM_ID,
      MOCK_AUTH,
    );
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listMemberPhotos).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(PHOTOS_PATH);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
