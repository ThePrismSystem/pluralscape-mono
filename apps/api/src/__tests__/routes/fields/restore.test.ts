import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/field-definition.service.js", () => ({
  listFieldDefinitions: vi.fn(),
  createFieldDefinition: vi.fn(),
  getFieldDefinition: vi.fn(),
  updateFieldDefinition: vi.fn(),
  archiveFieldDefinition: vi.fn(),
  restoreFieldDefinition: vi.fn(),
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

vi.mock("../../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_test" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set(["sys_test" as AuthContext["systemId"] & string]),
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

const { restoreFieldDefinition } = await import("../../../services/field-definition.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const FLD_ID = "fld_550e8400-e29b-41d4-a716-446655440000";

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const FIELD_DEFINITION_RESULT = {
  id: FLD_ID as never,
  systemId: SYS_ID as never,
  fieldType: "text" as const,
  required: false,
  sortOrder: 0,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
  archived: false,
  archivedAt: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/fields/:fieldId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreFieldDefinition).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored field definition result", async () => {
    vi.mocked(restoreFieldDefinition).mockResolvedValueOnce(FIELD_DEFINITION_RESULT);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields/${FLD_ID}/restore`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; fieldType: string; version: number };
    expect(body.id).toBe(FLD_ID);
    expect(body.fieldType).toBe("text");
    expect(body.version).toBe(1);
  });

  it("returns 404 when field not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(restoreFieldDefinition).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Field definition not found"),
    );

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields/${FLD_ID}/restore`, {
      method: "POST",
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(restoreFieldDefinition).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields/${FLD_ID}/restore`, {
      method: "POST",
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
