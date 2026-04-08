import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../../lib/api-error.js";
import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/field-bucket-visibility.service.js", () => ({
  setFieldBucketVisibility: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { setFieldBucketVisibility } =
  await import("../../../../services/field-bucket-visibility.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const FIELD_ID = "fld_660e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_770e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYS_ID}/fields/${FIELD_ID}/bucket-visibility`;

const VALID_BODY = { bucketId: BUCKET_ID };

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/fields/:fieldDefinitionId/bucket-visibility", () => {
  beforeEach(() => {
    vi.mocked(setFieldBucketVisibility).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with visibility result", async () => {
    vi.mocked(setFieldBucketVisibility).mockResolvedValueOnce({
      fieldDefinitionId: FIELD_ID as never,
      bucketId: BUCKET_ID as never,
    });

    const res = await postJSON(createApp(), BASE_URL, VALID_BODY);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { bucketId: string } };
    expect(body.data.bucketId).toBe(BUCKET_ID);
  });

  it("passes parsed bucketId to service", async () => {
    vi.mocked(setFieldBucketVisibility).mockResolvedValueOnce({
      fieldDefinitionId: FIELD_ID as never,
      bucketId: BUCKET_ID as never,
    });

    await postJSON(createApp(), BASE_URL, VALID_BODY);

    expect(vi.mocked(setFieldBucketVisibility)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      FIELD_ID,
      BUCKET_ID,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 when body fails schema validation", async () => {
    const res = await postJSON(createApp(), BASE_URL, { bucketId: "not-valid" });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(vi.mocked(setFieldBucketVisibility)).not.toHaveBeenCalled();
  });

  it("returns 400 when body is missing bucketId", async () => {
    const res = await postJSON(createApp(), BASE_URL, {});

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await postJSON(
      createApp(),
      `/systems/not-valid/fields/${FIELD_ID}/bucket-visibility`,
      VALID_BODY,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid fieldDefinitionId format", async () => {
    const res = await postJSON(
      createApp(),
      `/systems/${SYS_ID}/fields/not-valid/bucket-visibility`,
      VALID_BODY,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([[404, "NOT_FOUND", "Field definition not found"]] as const)(
    "maps service ApiHttpError %i %s to HTTP response",
    async (status, code, message) => {
      vi.mocked(setFieldBucketVisibility).mockRejectedValueOnce(
        new ApiHttpError(status, code, message),
      );

      const res = await postJSON(createApp(), BASE_URL, VALID_BODY);

      expect(res.status).toBe(status);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe(code);
    },
  );
});
