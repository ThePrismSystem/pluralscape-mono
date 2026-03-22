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

vi.mock("../../../../services/field-value.service.js", () => ({
  listFieldValues: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listFieldValues } = await import("../../../../services/field-value.service.js");
const { createCategoryRateLimiter } = await import("../../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const MEM_ID = "mem_550e8400-e29b-41d4-a716-446655440000";
const FLD_DEF_ID = "fld_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const FIELDS_PATH = `/systems/${SYS_ID}/members/${MEM_ID}/fields`;

const FIELD_VALUE_RESULT = {
  id: "fv_550e8400-e29b-41d4-a716-446655440000" as never,
  fieldDefinitionId: FLD_DEF_ID as never,
  memberId: MEM_ID as never,
  structureEntityId: null,
  groupId: null,
  systemId: SYS_ID as never,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/members/:memberId/fields", () => {
  beforeEach(() => {
    vi.mocked(listFieldValues).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with field value items in data envelope", async () => {
    vi.mocked(listFieldValues).mockResolvedValueOnce([FIELD_VALUE_RESULT]);

    const app = createApp();
    const res = await app.request(FIELDS_PATH);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { items: { id: string; memberId: string; version: number }[] };
    };
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]?.id).toBe("fv_550e8400-e29b-41d4-a716-446655440000");
    expect(body.data.items[0]?.memberId).toBe(MEM_ID);
    expect(body.data.items[0]?.version).toBe(1);
  });

  it("returns 200 with empty items array in data envelope", async () => {
    vi.mocked(listFieldValues).mockResolvedValueOnce([]);

    const app = createApp();
    const res = await app.request(FIELDS_PATH);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { items: unknown[] } };
    expect(body.data.items).toHaveLength(0);
  });

  it("forwards systemId and memberId to service", async () => {
    vi.mocked(listFieldValues).mockResolvedValueOnce([FIELD_VALUE_RESULT]);

    const app = createApp();
    await app.request(FIELDS_PATH);

    expect(vi.mocked(listFieldValues)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MEM_ID,
      MOCK_AUTH,
    );
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listFieldValues).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(FIELDS_PATH);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
