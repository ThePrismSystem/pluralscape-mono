import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../../lib/api-error.js";
import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/snapshot.service.js", () => ({
  deleteSnapshot: vi.fn(),
}));
vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { deleteSnapshot } = await import("../../../../services/snapshot.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const SNAPSHOT_ID = "snap_660e8400-e29b-41d4-a716-446655440000";
const DELETE_URL = `/systems/${SYS_ID}/snapshots/${SNAPSHOT_ID}`;

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /systems/:systemId/snapshots/:snapshotId", () => {
  beforeEach(() => {
    vi.mocked(deleteSnapshot).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteSnapshot).mockResolvedValueOnce(undefined);

    const res = await createApp().request(DELETE_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("passes ids to service", async () => {
    vi.mocked(deleteSnapshot).mockResolvedValueOnce(undefined);

    await createApp().request(DELETE_URL, { method: "DELETE" });

    expect(vi.mocked(deleteSnapshot)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      SNAPSHOT_ID,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/snapshots/${SNAPSHOT_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid snapshotId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/snapshots/not-valid`, {
      method: "DELETE",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([[404, "NOT_FOUND", "Snapshot not found"]] as const)(
    "maps service ApiHttpError %i %s to HTTP response",
    async (status, code, message) => {
      vi.mocked(deleteSnapshot).mockRejectedValueOnce(new ApiHttpError(status, code, message));

      const res = await createApp().request(DELETE_URL, { method: "DELETE" });

      expect(res.status).toBe(status);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe(code);
    },
  );
});
