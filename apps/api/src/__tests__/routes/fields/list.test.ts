import { toCursor } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { FieldDefinitionResult } from "../../../services/field-definition.service.js";
import type { ApiErrorResponse, PaginatedResult } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/field-definition.service.js", () => ({
  listFieldDefinitions: vi.fn(),
  createFieldDefinition: vi.fn(),
  getFieldDefinition: vi.fn(),
  updateFieldDefinition: vi.fn(),
  archiveFieldDefinition: vi.fn(),
  restoreFieldDefinition: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listFieldDefinitions } = await import("../../../services/field-definition.service.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const FLD_ID = "fld_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const EMPTY_PAGE: PaginatedResult<FieldDefinitionResult> = {
  items: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/fields", () => {
  beforeEach(() => {
    vi.mocked(listFieldDefinitions).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list when no field definitions exist", async () => {
    vi.mocked(listFieldDefinitions).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<FieldDefinitionResult>;
    expect(body.items).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it("returns 200 with paginated field definitions", async () => {
    const page: PaginatedResult<FieldDefinitionResult> = {
      items: [
        {
          id: FLD_ID as never,
          systemId: SYS_ID as never,
          fieldType: "text",
          required: false,
          sortOrder: 0,
          encryptedData: "dGVzdA==",
          version: 1,
          createdAt: 1000 as never,
          updatedAt: 1000 as never,
          archived: false,
          archivedAt: null,
        },
      ],
      nextCursor: FLD_ID as never,
      hasMore: true,
      totalCount: null,
    };
    vi.mocked(listFieldDefinitions).mockResolvedValueOnce(page);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields?limit=1`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<FieldDefinitionResult>;
    expect(body.items).toHaveLength(1);
    expect(body.hasMore).toBe(true);
  });

  it("forwards systemId, auth, cursor, limit, and includeArchived to service", async () => {
    vi.mocked(listFieldDefinitions).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/fields?cursor=fld_abc&limit=10&includeArchived=true`);

    expect(vi.mocked(listFieldDefinitions)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      { cursor: toCursor("fld_abc"), limit: 10, includeArchived: true },
    );
  });

  it("caps limit to MAX_FIELD_LIMIT", async () => {
    vi.mocked(listFieldDefinitions).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/fields?limit=999`);

    expect(vi.mocked(listFieldDefinitions)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      { cursor: undefined, limit: 100, includeArchived: false },
    );
  });

  it("passes default limit when not provided", async () => {
    vi.mocked(listFieldDefinitions).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/fields`);

    expect(vi.mocked(listFieldDefinitions)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      { cursor: undefined, limit: 25, includeArchived: false },
    );
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });

  it("returns 400 for invalid includeArchived value", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields?includeArchived=yes`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listFieldDefinitions).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields`);

    expect(res.status).toBe(500);
  });
});
