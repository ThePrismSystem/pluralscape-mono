import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

vi.mock("../../../services/group/lifecycle.js", () => ({
  archiveGroup: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
const { archiveGroup } = await import("../../../services/group/lifecycle.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

const ARCHIVE_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups/grp_660e8400-e29b-41d4-a716-446655440000/archive";

describe("POST /systems/:id/groups/:groupId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveGroup).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(archiveGroup).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when group not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveGroup).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Group not found"),
    );

    const app = createApp();
    const res = await app.request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
