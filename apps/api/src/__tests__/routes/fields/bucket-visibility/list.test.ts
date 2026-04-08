import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/field-bucket-visibility.service.js", () => ({
  listFieldBucketVisibility: vi.fn(),
}));

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listFieldBucketVisibility } =
  await import("../../../../services/field-bucket-visibility.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const FIELD_ID = "fld_660e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYS_ID}/fields/${FIELD_ID}/bucket-visibility`;

// ── Tests ────────────────────────────────────────────────────────

// No error-mapping cases — listFieldBucketVisibility does not throw ApiHttpError.
describe("GET /systems/:id/fields/:fieldDefinitionId/bucket-visibility", () => {
  beforeEach(() => {
    vi.mocked(listFieldBucketVisibility).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with visibility list", async () => {
    vi.mocked(listFieldBucketVisibility).mockResolvedValueOnce([
      {
        fieldDefinitionId: FIELD_ID as never,
        bucketId: "bkt_770e8400-e29b-41d4-a716-446655440000" as never,
      },
    ]);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });

  it("calls service with correct args", async () => {
    vi.mocked(listFieldBucketVisibility).mockResolvedValueOnce([]);

    await createApp().request(BASE_URL);

    expect(vi.mocked(listFieldBucketVisibility)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      FIELD_ID,
      expect.any(Object),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(
      `/systems/not-valid/fields/${FIELD_ID}/bucket-visibility`,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid fieldDefinitionId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/fields/not-valid/bucket-visibility`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
