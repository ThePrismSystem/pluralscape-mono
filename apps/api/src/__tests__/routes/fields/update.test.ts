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

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { updateFieldDefinition } = await import("../../../services/field-definition.service.js");
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

async function putJSON(app: Hono, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = { encryptedData: "dGVzdA==", version: 1 };

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

describe("PUT /systems/:systemId/fields/:fieldId", () => {
  beforeEach(() => {
    vi.mocked(updateFieldDefinition).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated field definition", async () => {
    vi.mocked(updateFieldDefinition).mockResolvedValueOnce(FIELD_DEFINITION_RESULT);

    const app = createApp();
    const res = await putJSON(app, `/systems/${SYS_ID}/fields/${FLD_ID}`, VALID_BODY);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; fieldType: string; version: number };
    expect(body.id).toBe(FLD_ID);
    expect(body.fieldType).toBe("text");
    expect(body.version).toBe(1);
  });

  it("forwards systemId, fieldId, body, auth, and audit writer to service", async () => {
    vi.mocked(updateFieldDefinition).mockResolvedValueOnce(FIELD_DEFINITION_RESULT);

    const app = createApp();
    await putJSON(app, `/systems/${SYS_ID}/fields/${FLD_ID}`, VALID_BODY);

    expect(vi.mocked(updateFieldDefinition)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      FLD_ID,
      VALID_BODY,
      MOCK_AUTH,
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(expect.anything(), MOCK_AUTH);
  });

  it("returns 400 for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields/${FLD_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 on conflict", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(updateFieldDefinition).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );

    const app = createApp();
    const res = await putJSON(app, `/systems/${SYS_ID}/fields/${FLD_ID}`, VALID_BODY);

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(updateFieldDefinition).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await putJSON(app, `/systems/${SYS_ID}/fields/${FLD_ID}`, VALID_BODY);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
