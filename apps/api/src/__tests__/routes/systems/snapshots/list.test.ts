import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../../helpers/route-test-setup.js";

import type { EncryptedBase64, ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/snapshot.service.js", () => ({
  listSnapshots: vi.fn(),
}));
vi.mock("../../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listSnapshots } = await import("../../../../services/snapshot.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const SNAPSHOT_ID = "snap_660e8400-e29b-41d4-a716-446655440000";
const LIST_URL = `/systems/${SYS_ID}/snapshots`;

const MOCK_SNAPSHOT = {
  id: SNAPSHOT_ID as never,
  systemId: SYS_ID as never,
  snapshotTrigger: "manual" as const,
  encryptedData: "dGVzdA==" as EncryptedBase64,
  createdAt: 1000 as never,
};

const MOCK_LIST_RESULT = {
  data: [MOCK_SNAPSHOT],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

// ── Tests ────────────────────────────────────────────────────────

// No error-mapping cases — listSnapshots does not throw ApiHttpError.
describe("GET /systems/:systemId/snapshots", () => {
  beforeEach(() => {
    vi.mocked(listSnapshots).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with paginated list", async () => {
    vi.mocked(listSnapshots).mockResolvedValueOnce(MOCK_LIST_RESULT);

    const res = await createApp().request(LIST_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });

  it("passes cursor and limit to service", async () => {
    vi.mocked(listSnapshots).mockResolvedValueOnce(MOCK_LIST_RESULT);

    await createApp().request(`${LIST_URL}?limit=10`);

    expect(vi.mocked(listSnapshots)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      expect.any(Object),
      undefined,
      10,
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/snapshots`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
