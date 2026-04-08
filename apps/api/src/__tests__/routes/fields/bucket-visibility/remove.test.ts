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

vi.mock("../../../../services/field-bucket-visibility.service.js", () => ({
  removeFieldBucketVisibility: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { removeFieldBucketVisibility } =
  await import("../../../../services/field-bucket-visibility.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const FIELD_ID = "fld_660e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_770e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYS_ID}/fields/${FIELD_ID}/bucket-visibility/${BUCKET_ID}`;

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /systems/:id/fields/:fieldDefinitionId/bucket-visibility/:bucketId", () => {
  beforeEach(() => {
    vi.mocked(removeFieldBucketVisibility).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(removeFieldBucketVisibility).mockResolvedValueOnce(undefined);

    const res = await createApp().request(BASE_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("passes ids to service", async () => {
    vi.mocked(removeFieldBucketVisibility).mockResolvedValueOnce(undefined);

    await createApp().request(BASE_URL, { method: "DELETE" });

    expect(vi.mocked(removeFieldBucketVisibility)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      FIELD_ID,
      BUCKET_ID,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(
      `/systems/not-valid/fields/${FIELD_ID}/bucket-visibility/${BUCKET_ID}`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid fieldDefinitionId format", async () => {
    const res = await createApp().request(
      `/systems/${SYS_ID}/fields/not-valid/bucket-visibility/${BUCKET_ID}`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid bucketId format", async () => {
    const res = await createApp().request(
      `/systems/${SYS_ID}/fields/${FIELD_ID}/bucket-visibility/not-valid`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([[404, "NOT_FOUND", "Field bucket visibility not found"]] as const)(
    "maps service ApiHttpError %i %s to HTTP response",
    async (status, code, message) => {
      vi.mocked(removeFieldBucketVisibility).mockRejectedValueOnce(
        new ApiHttpError(status, code, message),
      );

      const res = await createApp().request(BASE_URL, { method: "DELETE" });

      expect(res.status).toBe(status);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe(code);
    },
  );
});
