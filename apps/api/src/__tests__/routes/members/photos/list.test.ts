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
  listMemberPhotos: vi.fn(),
  DEFAULT_PHOTO_LIMIT: 25,
  MAX_PHOTO_LIMIT: 50,
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listMemberPhotos } = await import("../../../../services/member-photo.service.js");
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

const PAGINATED_RESULT = {
  items: [PHOTO_RESULT],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

const EMPTY_PAGINATED_RESULT = {
  items: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

const PHOTOS_PATH = `/systems/${SYS_ID}/members/${MEM_ID}/photos`;

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/members/:memberId/photos", () => {
  beforeEach(() => {
    vi.mocked(listMemberPhotos).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with paginated result on success", async () => {
    vi.mocked(listMemberPhotos).mockResolvedValueOnce(PAGINATED_RESULT);

    const app = createApp();
    const res = await app.request(PHOTOS_PATH);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof PAGINATED_RESULT;
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.id).toBe(PHOTO_ID);
    expect(body.items[0]?.memberId).toBe(MEM_ID);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
  });

  it("returns 200 with empty items when no photos", async () => {
    vi.mocked(listMemberPhotos).mockResolvedValueOnce(EMPTY_PAGINATED_RESULT);

    const app = createApp();
    const res = await app.request(PHOTOS_PATH);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof EMPTY_PAGINATED_RESULT;
    expect(body.items).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it("forwards systemId, memberId, auth, and pagination opts to service", async () => {
    vi.mocked(listMemberPhotos).mockResolvedValueOnce(PAGINATED_RESULT);

    const app = createApp();
    await app.request(`${PHOTOS_PATH}?limit=10`);

    expect(vi.mocked(listMemberPhotos)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MEM_ID,
      MOCK_AUTH,
      expect.objectContaining({ limit: 10 }),
    );
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listMemberPhotos).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(PHOTOS_PATH);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
