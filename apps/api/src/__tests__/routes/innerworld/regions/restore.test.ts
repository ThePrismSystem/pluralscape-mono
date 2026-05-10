import { brandId, toUnixMillis } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_SYSTEM_ID, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse, EncryptedBase64, InnerWorldRegionId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/innerworld/region/lifecycle.js", () => ({
  restoreRegion: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { restoreRegion } = await import("../../../../services/innerworld/region/lifecycle.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/innerworld/regions";
const RESTORE_URL = `${BASE_URL}/iwr_660e8400-e29b-41d4-a716-446655440000/restore`;

const MOCK_REGION = {
  id: brandId<InnerWorldRegionId>("iwr_660e8400-e29b-41d4-a716-446655440000"),
  systemId: MOCK_SYSTEM_ID,
  parentRegionId: null,
  encryptedData: "dGVzdA==" as EncryptedBase64,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: toUnixMillis(1000),
  updatedAt: toUnixMillis(2000),
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/innerworld/regions/:regionId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreRegion).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored region", async () => {
    vi.mocked(restoreRegion).mockResolvedValueOnce(MOCK_REGION);

    const res = await createApp().request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(200);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(restoreRegion).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Region not found"),
    );

    const res = await createApp().request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
