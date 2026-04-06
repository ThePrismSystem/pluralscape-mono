import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/system.service.js", () => ({
  archiveSystem: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../middleware/scope.js", () => mockScopeFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { archiveSystem } = await import("../../../services/system.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /systems/:id", () => {
  beforeEach(() => {
    vi.mocked(archiveSystem).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(archiveSystem).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request("/systems/sys_550e8400-e29b-41d4-a716-446655440000", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
  });

  it("forwards systemId, auth, and audit writer to service", async () => {
    vi.mocked(archiveSystem).mockResolvedValueOnce(undefined);

    const app = createApp();
    await app.request("/systems/sys_550e8400-e29b-41d4-a716-446655440000", { method: "DELETE" });

    expect(vi.mocked(archiveSystem)).toHaveBeenCalledWith(
      expect.anything(),
      "sys_550e8400-e29b-41d4-a716-446655440000",
      MOCK_AUTH,
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(expect.anything(), MOCK_AUTH);
  });

  it("returns 404 when system not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveSystem).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "System not found"),
    );

    const app = createApp();
    const res = await app.request("/systems/sys_550e8400-e29b-41d4-a716-446655440000", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when system has dependents", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveSystem).mockRejectedValueOnce(
      new ApiHttpError(
        409,
        "HAS_DEPENDENTS",
        "System has 3 active member(s). Delete all members before deleting the system.",
      ),
    );

    const app = createApp();
    const res = await app.request("/systems/sys_550e8400-e29b-41d4-a716-446655440000", {
      method: "DELETE",
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });

  it("returns 409 when it is the last system", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveSystem).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Cannot delete the only system on the account"),
    );

    const app = createApp();
    const res = await app.request("/systems/sys_550e8400-e29b-41d4-a716-446655440000", {
      method: "DELETE",
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.message).toBe("Cannot delete the only system on the account");
  });

  it("returns 400 for invalid system ID format", async () => {
    const app = createApp();
    const res = await app.request("/systems/not-a-valid-id", { method: "DELETE" });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(archiveSystem).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request("/systems/sys_550e8400-e29b-41d4-a716-446655440000", {
      method: "DELETE",
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
