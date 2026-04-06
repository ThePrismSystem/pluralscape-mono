import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/field-definition.service.js", () => ({
  deleteFieldDefinition: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../middleware/scope.js", () => mockScopeFactory());

const { deleteFieldDefinition } = await import("../../../services/field-definition.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const FIELD_ID = "fld_660e8400-e29b-41d4-a716-446655440000";
const FIELD_URL = `/systems/${SYS_ID}/fields/${FIELD_ID}`;

const createApp = () => createRouteApp("/systems", systemRoutes);

describe("DELETE /systems/:systemId/fields/:fieldId", () => {
  beforeEach(() => {
    vi.mocked(deleteFieldDefinition).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 with empty body on success", async () => {
    vi.mocked(deleteFieldDefinition).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(FIELD_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("passes force=false by default", async () => {
    vi.mocked(deleteFieldDefinition).mockResolvedValueOnce(undefined);

    const app = createApp();
    await app.request(FIELD_URL, { method: "DELETE" });

    expect(vi.mocked(deleteFieldDefinition)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      FIELD_ID,
      expect.anything(),
      expect.anything(),
      { force: false },
    );
  });

  it("passes force=true when query param is set", async () => {
    vi.mocked(deleteFieldDefinition).mockResolvedValueOnce(undefined);

    const app = createApp();
    await app.request(`${FIELD_URL}?force=true`, { method: "DELETE" });

    expect(vi.mocked(deleteFieldDefinition)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      FIELD_ID,
      expect.anything(),
      expect.anything(),
      { force: true },
    );
  });

  it("returns 404 when field definition not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteFieldDefinition).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Field definition not found"),
    );

    const app = createApp();
    const res = await app.request(FIELD_URL, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when field definition has dependents", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteFieldDefinition).mockRejectedValueOnce(
      new ApiHttpError(409, "HAS_DEPENDENTS", "Field definition has dependents."),
    );

    const app = createApp();
    const res = await app.request(FIELD_URL, { method: "DELETE" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(deleteFieldDefinition).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(FIELD_URL, { method: "DELETE" });

    expect(res.status).toBe(500);
  });
});
