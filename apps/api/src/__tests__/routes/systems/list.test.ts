import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toCursor } from "../../../lib/pagination.js";
import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { SystemProfileResult } from "../../../services/system.service.js";
import type { PaginatedResult } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/system.service.js", () => ({
  listSystems: vi.fn(),
  getSystemProfile: vi.fn(),
  updateSystemProfile: vi.fn(),
  archiveSystem: vi.fn(),
  createSystem: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listSystems } = await import("../../../services/system.service.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const EMPTY_PAGE: PaginatedResult<SystemProfileResult> = {
  data: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems", () => {
  beforeEach(() => {
    vi.mocked(listSystems).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list when no systems exist", async () => {
    vi.mocked(listSystems).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request("/systems");

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<SystemProfileResult>;
    expect(body.data).toEqual([]);
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
    expect(body.totalCount).toBeNull();
  });

  it("returns 200 with paginated systems", async () => {
    const page: PaginatedResult<SystemProfileResult> = {
      data: [
        {
          id: "sys_550e8400-e29b-41d4-a716-446655440000" as never,
          encryptedData: null,
          version: 1,
          createdAt: 1000 as never,
          updatedAt: 1000 as never,
        },
      ],
      nextCursor: "sys_550e8400-e29b-41d4-a716-446655440000" as never,
      hasMore: true,
      totalCount: null,
    };
    vi.mocked(listSystems).mockResolvedValueOnce(page);

    const app = createApp();
    const res = await app.request("/systems?limit=1");

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<SystemProfileResult>;
    expect(body.data).toHaveLength(1);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBeTruthy();
  });

  it("forwards accountId, cursor, and limit to service", async () => {
    vi.mocked(listSystems).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems?cursor=${toCursor("sys_abc")}&limit=10`);

    expect(vi.mocked(listSystems)).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_AUTH.accountId,
      "sys_abc",
      10,
    );
  });

  it("passes undefined cursor and default limit when not provided", async () => {
    vi.mocked(listSystems).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request("/systems");

    expect(vi.mocked(listSystems)).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_AUTH.accountId,
      undefined,
      25,
    );
  });

  it("caps limit to MAX_SYSTEM_LIMIT", async () => {
    vi.mocked(listSystems).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request("/systems?limit=999");

    expect(vi.mocked(listSystems)).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_AUTH.accountId,
      undefined,
      100,
    );
  });

  it("falls back to DEFAULT_SYSTEM_LIMIT for NaN limit", async () => {
    vi.mocked(listSystems).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request("/systems?limit=abc");

    expect(vi.mocked(listSystems)).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_AUTH.accountId,
      undefined,
      25,
    );
  });

  it("falls back to DEFAULT_SYSTEM_LIMIT for negative limit", async () => {
    vi.mocked(listSystems).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request("/systems?limit=-5");

    expect(vi.mocked(listSystems)).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_AUTH.accountId,
      undefined,
      25,
    );
  });

  it("falls back to DEFAULT_SYSTEM_LIMIT for zero limit", async () => {
    vi.mocked(listSystems).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request("/systems?limit=0");

    expect(vi.mocked(listSystems)).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_AUTH.accountId,
      undefined,
      25,
    );
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listSystems).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request("/systems");

    expect(res.status).toBe(500);
  });
});
