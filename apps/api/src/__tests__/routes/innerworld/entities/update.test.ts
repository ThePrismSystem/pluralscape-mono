import { brandId, toUnixMillis } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_SYSTEM_ID, createRouteApp } from "../../../helpers/route-test-setup.js";

import type {
  ApiErrorResponse,
  EncryptedBase64,
  InnerWorldEntityId,
  InnerWorldRegionId,
} from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/innerworld/entity/update.js", () => ({
  updateEntity: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { updateEntity } = await import("../../../../services/innerworld/entity/update.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/innerworld/entities";
const ENTITY_URL = `${BASE_URL}/iwe_660e8400-e29b-41d4-a716-446655440000`;

const MOCK_ENTITY = {
  id: brandId<InnerWorldEntityId>("iwe_660e8400-e29b-41d4-a716-446655440000"),
  systemId: MOCK_SYSTEM_ID,
  regionId: brandId<InnerWorldRegionId>("iwr_test"),
  encryptedData: "dGVzdA==" as EncryptedBase64,
  version: 2,
  archived: false,
  archivedAt: null,
  createdAt: toUnixMillis(1000),
  updatedAt: toUnixMillis(2000),
};

const VALID_BODY = { encryptedData: "dXBkYXRlZA==" as EncryptedBase64, version: 1 };

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /systems/:id/innerworld/entities/:entityId", () => {
  beforeEach(() => {
    vi.mocked(updateEntity).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated entity", async () => {
    vi.mocked(updateEntity).mockResolvedValueOnce(MOCK_ENTITY);

    const res = await createApp().request(ENTITY_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_ENTITY };
    expect(body.data.id).toBe("iwe_660e8400-e29b-41d4-a716-446655440000");
    expect(body.data.version).toBe(2);
    expect(body.data.updatedAt).toBe(2000);
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await createApp().request(ENTITY_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for empty object body", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(updateEntity).mockRejectedValueOnce(
      new ApiHttpError(400, "VALIDATION_ERROR", "Missing required fields"),
    );
    const res = await createApp().request(ENTITY_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(updateEntity).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Entity not found"),
    );

    const res = await createApp().request(ENTITY_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when version conflicts", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(updateEntity).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version mismatch"),
    );
    const res = await createApp().request(ENTITY_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });
});
