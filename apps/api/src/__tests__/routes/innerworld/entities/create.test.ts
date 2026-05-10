import { brandId, toUnixMillis } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_SYSTEM_ID, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { EncryptedBase64, InnerWorldEntityId, InnerWorldRegionId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/innerworld/entity/create.js", () => ({
  createEntity: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { createEntity } = await import("../../../../services/innerworld/entity/create.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/innerworld/entities";

const MOCK_ENTITY = {
  id: brandId<InnerWorldEntityId>("iwe_660e8400-e29b-41d4-a716-446655440000"),
  systemId: MOCK_SYSTEM_ID,
  regionId: brandId<InnerWorldRegionId>("iwr_test"),
  encryptedData: "dGVzdA==" as EncryptedBase64,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: toUnixMillis(1000),
  updatedAt: toUnixMillis(1000),
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/innerworld/entities", () => {
  beforeEach(() => {
    vi.mocked(createEntity).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new entity", async () => {
    vi.mocked(createEntity).mockResolvedValueOnce(MOCK_ENTITY);

    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encryptedData: "dGVzdA==" }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: typeof MOCK_ENTITY };
    expect(body.data.id).toBe("iwe_660e8400-e29b-41d4-a716-446655440000");
    expect(body.data.version).toBe(1);
    expect(body.data.archived).toBe(false);
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for empty object body", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(createEntity).mockRejectedValueOnce(
      new ApiHttpError(400, "VALIDATION_ERROR", "Missing required fields"),
    );
    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });
});
