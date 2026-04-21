import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/innerworld-region/lifecycle.js", () => ({
  archiveRegion: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { archiveRegion } = await import("../../../../services/innerworld-region/lifecycle.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/innerworld/regions";
const ARCHIVE_URL = `${BASE_URL}/iwr_660e8400-e29b-41d4-a716-446655440000/archive`;

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/innerworld/regions/:regionId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveRegion).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 No Content", async () => {
    vi.mocked(archiveRegion).mockResolvedValueOnce(undefined);

    const res = await createApp().request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(archiveRegion).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Region not found"),
    );

    const res = await createApp().request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
