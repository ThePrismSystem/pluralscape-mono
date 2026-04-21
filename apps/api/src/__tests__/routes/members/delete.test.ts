import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/member.js", () => ({
  deleteMember: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
const { deleteMember } = await import("../../../services/member.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

const MEMBER_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/members/mem_660e8400-e29b-41d4-a716-446655440000";

describe("DELETE /systems/:id/members/:memberId", () => {
  beforeEach(() => {
    vi.mocked(deleteMember).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 with empty body on success", async () => {
    vi.mocked(deleteMember).mockResolvedValueOnce(undefined);

    const app = createRouteApp("/systems", systemRoutes);
    const res = await app.request(MEMBER_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("returns 404 when member not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteMember).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Member not found"),
    );

    const app = createRouteApp("/systems", systemRoutes);
    const res = await app.request(MEMBER_URL, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when member has dependents", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteMember).mockRejectedValueOnce(
      new ApiHttpError(409, "HAS_DEPENDENTS", "Member has 2 fronting log(s)."),
    );

    const app = createRouteApp("/systems", systemRoutes);
    const res = await app.request(MEMBER_URL, { method: "DELETE" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(deleteMember).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createRouteApp("/systems", systemRoutes);
    const res = await app.request(MEMBER_URL, { method: "DELETE" });

    expect(res.status).toBe(500);
  });
});
