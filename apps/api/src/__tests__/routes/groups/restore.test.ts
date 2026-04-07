import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

vi.mock("../../../services/group.service.js", () => ({
  restoreGroup: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
const { restoreGroup } = await import("../../../services/group.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

const RESTORE_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups/grp_660e8400-e29b-41d4-a716-446655440000/restore";

describe("POST /systems/:id/groups/:groupId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreGroup).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored group", async () => {
    vi.mocked(restoreGroup).mockResolvedValueOnce({
      id: "grp_660e8400-e29b-41d4-a716-446655440000" as never,
      systemId: MOCK_AUTH.systemId as never,
      parentGroupId: null,
      sortOrder: 0,
      encryptedData: "dGVzdA==",
      version: 2,
      createdAt: 1000 as never,
      updatedAt: 2000 as never,
      archived: false,
      archivedAt: null,
    });

    const app = createApp();
    const res = await app.request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { version: number } };
    expect(body.data.version).toBe(2);
  });

  it("returns 404 when archived group not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(restoreGroup).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Archived group not found"),
    );

    const app = createApp();
    const res = await app.request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
