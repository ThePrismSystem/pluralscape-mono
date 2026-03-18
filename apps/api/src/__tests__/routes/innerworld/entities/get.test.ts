import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/innerworld-entity.service.js", () => ({
  getEntity: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { getEntity } = await import("../../../../services/innerworld-entity.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/innerworld/entities";
const ENTITY_URL = `${BASE_URL}/iwe_660e8400-e29b-41d4-a716-446655440000`;

const MOCK_ENTITY = {
  id: "iwe_660e8400-e29b-41d4-a716-446655440000" as never,
  systemId: MOCK_AUTH.systemId as never,
  regionId: "iwr_test" as never,
  encryptedData: "dGVzdA==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:id/innerworld/entities/:entityId", () => {
  beforeEach(() => {
    vi.mocked(getEntity).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with entity", async () => {
    vi.mocked(getEntity).mockResolvedValueOnce(MOCK_ENTITY);

    const res = await createApp().request(ENTITY_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_ENTITY;
    expect(body.id).toBe("iwe_660e8400-e29b-41d4-a716-446655440000");
    expect(body.encryptedData).toBe("dGVzdA==");
    expect(body.archived).toBe(false);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(getEntity).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Entity not found"),
    );

    const res = await createApp().request(ENTITY_URL);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid entityId format", async () => {
    const res = await createApp().request(`${BASE_URL}/not-valid`);

    expect(res.status).toBe(400);
  });
});
