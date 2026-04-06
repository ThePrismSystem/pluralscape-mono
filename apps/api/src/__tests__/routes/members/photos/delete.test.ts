import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/member-photo.service.js", () => ({
  deleteMemberPhoto: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../../middleware/scope.js", () => mockScopeFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { deleteMemberPhoto } = await import("../../../../services/member-photo.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const MEM_ID = "mem_550e8400-e29b-41d4-a716-446655440000";
const PHOTO_ID = "mp_550e8400-e29b-41d4-a716-446655440000";

const PHOTO_URL = `/systems/${SYS_ID}/members/${MEM_ID}/photos/${PHOTO_ID}`;

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /systems/:systemId/members/:memberId/photos/:photoId", () => {
  beforeEach(() => {
    vi.mocked(deleteMemberPhoto).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 with empty body on success", async () => {
    vi.mocked(deleteMemberPhoto).mockResolvedValueOnce(undefined);

    const app = createRouteApp("/systems", systemRoutes);
    const res = await app.request(PHOTO_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("returns 404 when photo not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(deleteMemberPhoto).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Member photo not found"),
    );

    const app = createRouteApp("/systems", systemRoutes);
    const res = await app.request(PHOTO_URL, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(deleteMemberPhoto).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createRouteApp("/systems", systemRoutes);
    const res = await app.request(PHOTO_URL, { method: "DELETE" });

    expect(res.status).toBe(500);
  });
});
