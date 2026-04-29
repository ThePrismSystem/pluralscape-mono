import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/system-duplicate.service.js", () => ({
  duplicateSystem: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { duplicateSystem } = await import("../../../services/system-duplicate.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const NEW_SYS_ID = "sys_660e8400-e29b-41d4-a716-446655440000";
const DUPLICATE_URL = `/systems/${SYS_ID}/duplicate`;

const VALID_BODY = { snapshotId: "snap_770e8400-e29b-41d4-a716-446655440000" };

const MOCK_RESULT = {
  id: NEW_SYS_ID as never,
  sourceSnapshotId: "snap_770e8400-e29b-41d4-a716-446655440000" as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/duplicate", () => {
  beforeEach(() => {
    vi.mocked(duplicateSystem).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with duplicated system", async () => {
    vi.mocked(duplicateSystem).mockResolvedValueOnce(MOCK_RESULT);

    const res = await postJSON(createApp(), DUPLICATE_URL, VALID_BODY);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(NEW_SYS_ID);
  });

  it("passes systemId and body to service", async () => {
    vi.mocked(duplicateSystem).mockResolvedValueOnce(MOCK_RESULT);

    await postJSON(createApp(), DUPLICATE_URL, VALID_BODY);

    expect(vi.mocked(duplicateSystem)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      VALID_BODY,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await postJSON(createApp(), `/systems/not-valid/duplicate`, VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await createApp().request(DUPLICATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    [403, "FORBIDDEN", "Only system accounts can duplicate systems"],
    [404, "NOT_FOUND", "Source system not found"],
  ] as const)("maps service ApiHttpError %i %s to HTTP response", async (status, code, message) => {
    vi.mocked(duplicateSystem).mockRejectedValueOnce(new ApiHttpError(status, code, message));

    const res = await postJSON(createApp(), DUPLICATE_URL, VALID_BODY);

    expect(res.status).toBe(status);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe(code);
  });
});
