import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../../middleware/request-id.js";

import type { AuthContext } from "../../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/field-value.service.js", () => ({
  listFieldValues: vi.fn(),
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

const { listFieldValues } = await import("../../../../services/field-value.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const MEM_ID = "mem_550e8400-e29b-41d4-a716-446655440000";
const FLD_DEF_ID = "fld_550e8400-e29b-41d4-a716-446655440000";

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const FIELDS_PATH = `/systems/${SYS_ID}/members/${MEM_ID}/fields`;

const FIELD_VALUE_RESULT = {
  id: "fv_550e8400-e29b-41d4-a716-446655440000" as never,
  fieldDefinitionId: FLD_DEF_ID as never,
  memberId: MEM_ID as never,
  systemId: SYS_ID as never,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/members/:memberId/fields", () => {
  beforeEach(() => {
    vi.mocked(listFieldValues).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with field value items", async () => {
    vi.mocked(listFieldValues).mockResolvedValueOnce([FIELD_VALUE_RESULT]);

    const app = createApp();
    const res = await app.request(FIELDS_PATH);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: { id: string; memberId: string; version: number }[];
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe("fv_550e8400-e29b-41d4-a716-446655440000");
    expect(body.items[0]?.memberId).toBe(MEM_ID);
    expect(body.items[0]?.version).toBe(1);
  });

  it("returns 200 with empty items array", async () => {
    vi.mocked(listFieldValues).mockResolvedValueOnce([]);

    const app = createApp();
    const res = await app.request(FIELDS_PATH);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(0);
  });

  it("forwards systemId and memberId to service", async () => {
    vi.mocked(listFieldValues).mockResolvedValueOnce([FIELD_VALUE_RESULT]);

    const app = createApp();
    await app.request(FIELDS_PATH);

    expect(vi.mocked(listFieldValues)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MEM_ID,
      MOCK_AUTH,
    );
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listFieldValues).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(FIELDS_PATH);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
