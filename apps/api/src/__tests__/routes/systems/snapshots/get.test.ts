import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../../lib/api-error.js";
import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../../helpers/route-test-setup.js";

import type { EncryptedBase64, ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/snapshot.service.js", () => ({
  getSnapshot: vi.fn(),
}));
vi.mock("../../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { getSnapshot } = await import("../../../../services/snapshot.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const SNAPSHOT_ID = "snap_660e8400-e29b-41d4-a716-446655440000";
const GET_URL = `/systems/${SYS_ID}/snapshots/${SNAPSHOT_ID}`;

const MOCK_RESULT = {
  id: SNAPSHOT_ID as never,
  systemId: SYS_ID as never,
  snapshotTrigger: "manual" as const,
  encryptedData: "dGVzdA==" as EncryptedBase64,
  createdAt: 1000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/snapshots/:snapshotId", () => {
  beforeEach(() => {
    vi.mocked(getSnapshot).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with snapshot", async () => {
    vi.mocked(getSnapshot).mockResolvedValueOnce(MOCK_RESULT);

    const res = await createApp().request(GET_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(SNAPSHOT_ID);
  });

  it("passes ids to service", async () => {
    vi.mocked(getSnapshot).mockResolvedValueOnce(MOCK_RESULT);

    await createApp().request(GET_URL);

    expect(vi.mocked(getSnapshot)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      SNAPSHOT_ID,
      expect.any(Object),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/snapshots/${SNAPSHOT_ID}`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid snapshotId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/snapshots/not-valid`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([[404, "NOT_FOUND", "Snapshot not found"]] as const)(
    "maps service ApiHttpError %i %s to HTTP response",
    async (status, code, message) => {
      vi.mocked(getSnapshot).mockRejectedValueOnce(new ApiHttpError(status, code, message));

      const res = await createApp().request(GET_URL);

      expect(res.status).toBe(status);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe(code);
    },
  );
});
