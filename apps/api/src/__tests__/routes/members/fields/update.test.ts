import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../../middleware/request-id.js";

import type { AuthContext } from "../../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/field-value.service.js", () => ({
  updateFieldValue: vi.fn(),
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

const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
const { updateFieldValue } = await import("../../../../services/field-value.service.js");
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

async function putJSON(app: Hono, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { encryptedData: "dGVzdA==" };

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

const FIELD_PATH = `/systems/${SYS_ID}/members/${MEM_ID}/fields/${FLD_DEF_ID}`;

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /systems/:systemId/members/:memberId/fields/:fieldDefId", () => {
  beforeEach(() => {
    vi.mocked(updateFieldValue).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated field value on success", async () => {
    vi.mocked(updateFieldValue).mockResolvedValueOnce(FIELD_VALUE_RESULT);

    const app = createApp();
    const res = await putJSON(app, FIELD_PATH, VALID_BODY);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; memberId: string; version: number };
    expect(body.id).toBe("fv_550e8400-e29b-41d4-a716-446655440000");
    expect(body.memberId).toBe(MEM_ID);
    expect(body.version).toBe(1);
  });

  it("forwards systemId, memberId, fieldDefId, body, auth, and audit writer to service", async () => {
    vi.mocked(updateFieldValue).mockResolvedValueOnce(FIELD_VALUE_RESULT);

    const app = createApp();
    await putJSON(app, FIELD_PATH, VALID_BODY);

    expect(vi.mocked(updateFieldValue)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MEM_ID,
      FLD_DEF_ID,
      VALID_BODY,
      MOCK_AUTH,
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(expect.anything(), MOCK_AUTH);
  });

  it("returns 400 for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(FIELD_PATH, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when field value not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(updateFieldValue).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Field value not found"),
    );

    const app = createApp();
    const res = await putJSON(app, FIELD_PATH, VALID_BODY);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 on conflict", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(updateFieldValue).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );

    const app = createApp();
    const res = await putJSON(app, FIELD_PATH, VALID_BODY);

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(updateFieldValue).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await putJSON(app, FIELD_PATH, VALID_BODY);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
