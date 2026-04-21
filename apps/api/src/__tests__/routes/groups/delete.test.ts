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

vi.mock("../../../services/group/lifecycle.js", () => ({
  deleteGroup: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
const { deleteGroup } = await import("../../../services/group/lifecycle.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

const GROUP_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups/grp_660e8400-e29b-41d4-a716-446655440000";

describe("DELETE /systems/:id/groups/:groupId", () => {
  beforeEach(() => {
    vi.mocked(deleteGroup).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteGroup).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(GROUP_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when group not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteGroup).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Group not found"),
    );

    const app = createApp();
    const res = await app.request(GROUP_URL, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when group has dependents", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteGroup).mockRejectedValueOnce(
      new ApiHttpError(409, "HAS_DEPENDENTS", "Group has 2 child group(s) and 3 member(s)."),
    );

    const app = createApp();
    const res = await app.request(GROUP_URL, { method: "DELETE" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(deleteGroup).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(GROUP_URL, { method: "DELETE" });

    expect(res.status).toBe(500);
  });
});
