import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/field-definition/archive.js", () => ({
  archiveFieldDefinition: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { archiveFieldDefinition } = await import("../../../services/field-definition/archive.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const FLD_ID = "fld_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/fields/:fieldId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveFieldDefinition).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(archiveFieldDefinition).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields/${FLD_ID}/archive`, {
      method: "POST",
    });

    expect(res.status).toBe(204);
  });

  it("returns 404 when field not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveFieldDefinition).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Field definition not found"),
    );

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields/${FLD_ID}/archive`, {
      method: "POST",
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(archiveFieldDefinition).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields/${FLD_ID}/archive`, {
      method: "POST",
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
