import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/field-definition.service.js", () => ({
  createFieldDefinition: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { createFieldDefinition } = await import("../../../services/field-definition.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const FLD_ID = "fld_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const VALID_BODY = { fieldType: "text", required: false, sortOrder: 0, encryptedData: "dGVzdA==" };

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

describe("POST /systems/:systemId/fields", () => {
  beforeEach(() => {
    vi.mocked(createFieldDefinition).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with created field definition", async () => {
    vi.mocked(createFieldDefinition).mockResolvedValueOnce(FIELD_DEFINITION_RESULT);

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/fields`, VALID_BODY);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; fieldType: string; version: number };
    expect(body.id).toBe(FLD_ID);
    expect(body.fieldType).toBe("text");
    expect(body.version).toBe(1);
  });

  it("forwards systemId, body, auth, and audit writer to service", async () => {
    vi.mocked(createFieldDefinition).mockResolvedValueOnce(FIELD_DEFINITION_RESULT);

    const app = createApp();
    await postJSON(app, `/systems/${SYS_ID}/fields`, VALID_BODY);

    expect(vi.mocked(createFieldDefinition)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      VALID_BODY,
      MOCK_AUTH,
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(expect.anything(), MOCK_AUTH);
  });

  it("returns 400 for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when system not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(createFieldDefinition).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "System not found"),
    );

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/fields`, VALID_BODY);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when quota exceeded", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(createFieldDefinition).mockRejectedValueOnce(
      new ApiHttpError(409, "QUOTA_EXCEEDED", "Maximum of 200 field definitions per system"),
    );

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/fields`, VALID_BODY);

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("QUOTA_EXCEEDED");
  });

  it("returns 400 for invalid system ID format", async () => {
    const app = createApp();
    const res = await postJSON(app, "/systems/not-a-valid-id/fields", VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(createFieldDefinition).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/fields`, VALID_BODY);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
