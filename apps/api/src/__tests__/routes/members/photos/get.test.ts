import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/member-photo.service.js", () => ({
  getMemberPhoto: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { getMemberPhoto } = await import("../../../../services/member-photo.service.js");
const { createCategoryRateLimiter } = await import("../../../../middleware/rate-limit.js");
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

const PHOTO_PATH = `/systems/${SYS_ID}/members/${MEM_ID}/photos/${PHOTO_ID}`;

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/members/:memberId/photos/:photoId", () => {
  beforeEach(() => {
    vi.mocked(getMemberPhoto).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with photo data on success", async () => {
    vi.mocked(getMemberPhoto).mockResolvedValueOnce(PHOTO_RESULT);

    const app = createApp();
    const res = await app.request(PHOTO_PATH);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof PHOTO_RESULT };
    expect(body.data.id).toBe(PHOTO_ID);
    expect(body.data.memberId).toBe(MEM_ID);
  });

  it("forwards systemId, memberId, photoId, and auth to service", async () => {
    vi.mocked(getMemberPhoto).mockResolvedValueOnce(PHOTO_RESULT);

    const app = createApp();
    await app.request(PHOTO_PATH);

    expect(vi.mocked(getMemberPhoto)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MEM_ID,
      PHOTO_ID,
      MOCK_AUTH,
    );
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });

  it("returns 400 for invalid photoId format", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/members/${MEM_ID}/photos/bad-id`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(getMemberPhoto).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(PHOTO_PATH);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
