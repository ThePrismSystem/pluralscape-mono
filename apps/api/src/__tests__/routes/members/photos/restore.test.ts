import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/member-photo.service.js", () => ({
  restoreMemberPhoto: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { restoreMemberPhoto } = await import("../../../../services/member-photo.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const MEM_ID = "mem_550e8400-e29b-41d4-a716-446655440000";
const PHOTO_ID = "mp_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const PHOTO_RESULT = {
  id: PHOTO_ID as never,
  memberId: MEM_ID as never,
  systemId: SYS_ID as never,
  sortOrder: 0,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
  archived: false,
  archivedAt: null,
};

const RESTORE_PATH = `/systems/${SYS_ID}/members/${MEM_ID}/photos/${PHOTO_ID}/restore`;

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/members/:memberId/photos/:photoId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreMemberPhoto).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored photo on success", async () => {
    vi.mocked(restoreMemberPhoto).mockResolvedValueOnce(PHOTO_RESULT);

    const app = createApp();
    const res = await app.request(RESTORE_PATH, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof PHOTO_RESULT };
    expect(body.data.id).toBe(PHOTO_ID);
    expect(body.data.memberId).toBe(MEM_ID);
    expect(body.data.archived).toBe(false);
  });

  it("returns 404 when photo not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(restoreMemberPhoto).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Photo not found"),
    );

    const app = createApp();
    const res = await app.request(RESTORE_PATH, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(restoreMemberPhoto).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(RESTORE_PATH, { method: "POST" });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
