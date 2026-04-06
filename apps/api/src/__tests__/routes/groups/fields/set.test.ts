import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
  mockSystemOwnershipFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/field-value.service.js", () => ({
  setFieldValueForOwner: vi.fn(),
  listFieldValuesForOwner: vi.fn(),
  updateFieldValueForOwner: vi.fn(),
  deleteFieldValueForOwner: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../../middleware/scope.js", () => mockScopeFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
const { setFieldValueForOwner } = await import("../../../../services/field-value.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const GRP_ID = "grp_550e8400-e29b-41d4-a716-446655440000";
const FLD_DEF_ID = "fld_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const VALID_BODY = { encryptedData: "dGVzdA==" };

const FIELD_VALUE_RESULT = {
  id: "fv_550e8400-e29b-41d4-a716-446655440000" as never,
  fieldDefinitionId: FLD_DEF_ID as never,
  memberId: null,
  structureEntityId: null,
  groupId: GRP_ID as never,
  systemId: SYS_ID as never,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

const FIELD_PATH = `/systems/${SYS_ID}/groups/${GRP_ID}/fields/${FLD_DEF_ID}`;

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/groups/:groupId/fields/:fieldDefId", () => {
  beforeEach(() => {
    vi.mocked(setFieldValueForOwner).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with created field value on success", async () => {
    vi.mocked(setFieldValueForOwner).mockResolvedValueOnce(FIELD_VALUE_RESULT);

    const app = createApp();
    const res = await postJSON(app, FIELD_PATH, VALID_BODY);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; groupId: string; version: number } };
    expect(body.data.id).toBe("fv_550e8400-e29b-41d4-a716-446655440000");
    expect(body.data.groupId).toBe(GRP_ID);
    expect(body.data.version).toBe(1);
  });

  it("forwards owner with kind group to service", async () => {
    vi.mocked(setFieldValueForOwner).mockResolvedValueOnce(FIELD_VALUE_RESULT);

    const app = createApp();
    await postJSON(app, FIELD_PATH, VALID_BODY);

    expect(vi.mocked(setFieldValueForOwner)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      { kind: "group", id: GRP_ID },
      FLD_DEF_ID,
      VALID_BODY,
      MOCK_AUTH,
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(expect.anything(), MOCK_AUTH);
  });

  it("returns 400 for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(FIELD_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when group not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(setFieldValueForOwner).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Group not found"),
    );

    const app = createApp();
    const res = await postJSON(app, FIELD_PATH, VALID_BODY);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 on conflict", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(setFieldValueForOwner).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Field value already exists"),
    );

    const app = createApp();
    const res = await postJSON(app, FIELD_PATH, VALID_BODY);

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(setFieldValueForOwner).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, FIELD_PATH, VALID_BODY);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
