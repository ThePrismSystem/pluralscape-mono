import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/field-value.service.js", () => ({
  setFieldValueForOwner: vi.fn(),
  listFieldValuesForOwner: vi.fn(),
  updateFieldValueForOwner: vi.fn(),
  deleteFieldValueForOwner: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listFieldValuesForOwner } = await import("../../../../services/field-value.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const GRP_ID = "grp_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/groups/:groupId/fields", () => {
  beforeEach(() => {
    vi.mocked(listFieldValuesForOwner).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with items array", async () => {
    vi.mocked(listFieldValuesForOwner).mockResolvedValueOnce([]);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/groups/${GRP_ID}/fields`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { data: unknown[] } };
    expect(body.data.data).toEqual([]);
  });

  it("forwards owner with kind group to service", async () => {
    vi.mocked(listFieldValuesForOwner).mockResolvedValueOnce([]);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/groups/${GRP_ID}/fields`);

    expect(vi.mocked(listFieldValuesForOwner)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      { kind: "group", id: GRP_ID },
      MOCK_AUTH,
    );
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listFieldValuesForOwner).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/groups/${GRP_ID}/fields`);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
