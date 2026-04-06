import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

vi.mock("../../../services/group.service.js", () => ({
  reorderGroups: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../middleware/scope.js", () => mockScopeFactory());

const { reorderGroups } = await import("../../../services/group.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

const REORDER_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups/reorder";

describe("POST /systems/:id/groups/reorder", () => {
  beforeEach(() => {
    vi.mocked(reorderGroups).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(reorderGroups).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(REORDER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations: [{ groupId: "grp_abc", sortOrder: 0 }] }),
    });

    expect(res.status).toBe(204);
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(reorderGroups).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(REORDER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operations: [{ groupId: "grp_abc", sortOrder: 0 }] }),
    });

    expect(res.status).toBe(500);
  });
});
