import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

vi.mock("../../../../services/group-membership.service.js", () => ({
  removeMember: vi.fn(),
}));
vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../../middleware/scope.js", () => mockScopeFactory());

const { removeMember } = await import("../../../../services/group-membership.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

const REMOVE_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups/grp_660e8400-e29b-41d4-a716-446655440000/members/mem_770e8400-e29b-41d4-a716-446655440000";

describe("DELETE /systems/:id/groups/:groupId/members/:memberId", () => {
  beforeEach(() => {
    vi.mocked(removeMember).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(removeMember).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(REMOVE_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when membership not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(removeMember).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Group membership not found"),
    );

    const app = createApp();
    const res = await app.request(REMOVE_URL, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
