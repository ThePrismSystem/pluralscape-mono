import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/field-value.service.js", () => ({
  deleteFieldValue: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { deleteFieldValue } = await import("../../../../services/field-value.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const MEM_ID = "mem_550e8400-e29b-41d4-a716-446655440000";
const FLD_DEF_ID = "fld_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const FIELD_PATH = `/systems/${SYS_ID}/members/${MEM_ID}/fields/${FLD_DEF_ID}`;

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /systems/:systemId/members/:memberId/fields/:fieldDefId", () => {
  beforeEach(() => {
    vi.mocked(deleteFieldValue).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteFieldValue).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(FIELD_PATH, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when field value not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(deleteFieldValue).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Field value not found"),
    );

    const app = createApp();
    const res = await app.request(FIELD_PATH, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(deleteFieldValue).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(FIELD_PATH, { method: "DELETE" });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
