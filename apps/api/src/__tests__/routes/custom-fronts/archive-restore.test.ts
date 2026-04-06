import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

vi.mock("../../../services/custom-front.service.js", () => ({
  archiveCustomFront: vi.fn(),
  restoreCustomFront: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../middleware/scope.js", () => mockScopeFactory());

const { archiveCustomFront, restoreCustomFront } =
  await import("../../../services/custom-front.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

const ARCHIVE_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/custom-fronts/cf_660e8400-e29b-41d4-a716-446655440000/archive";
const RESTORE_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/custom-fronts/cf_660e8400-e29b-41d4-a716-446655440000/restore";

describe("POST /systems/:id/custom-fronts/:customFrontId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveCustomFront).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(archiveCustomFront).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveCustomFront).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Custom front not found"),
    );

    const app = createApp();
    const res = await app.request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("POST /systems/:id/custom-fronts/:customFrontId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreCustomFront).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored custom front", async () => {
    vi.mocked(restoreCustomFront).mockResolvedValueOnce({
      id: "cf_660e8400-e29b-41d4-a716-446655440000" as never,
      systemId: MOCK_AUTH.systemId as never,
      encryptedData: "dGVzdA==",
      version: 2,
      archived: false,
      archivedAt: null,
      createdAt: 1000 as never,
      updatedAt: 2000 as never,
    });

    const app = createApp();
    const res = await app.request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { version: number } };
    expect(body.data.version).toBe(2);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(restoreCustomFront).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Archived custom front not found"),
    );

    const app = createApp();
    const res = await app.request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
