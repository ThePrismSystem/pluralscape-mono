import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON } from "../../../../helpers/route-test-setup.js";

import type { EncryptedBase64, ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../../services/field-value/set.js", () => ({
  setFieldValueForOwner: vi.fn(),
}));

vi.mock("../../../../../services/field-value/list.js", () => ({
  listFieldValuesForOwner: vi.fn(),
}));

vi.mock("../../../../../services/field-value/update.js", () => ({
  updateFieldValueForOwner: vi.fn(),
}));

vi.mock("../../../../../services/field-value/delete.js", () => ({
  deleteFieldValueForOwner: vi.fn(),
}));

vi.mock("../../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../../../lib/audit-writer.js");
const { setFieldValueForOwner } = await import("../../../../../services/field-value/set.js");
const { systemRoutes } = await import("../../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const ENTITY_ID = "ste_550e8400-e29b-41d4-a716-446655440000";
const FLD_DEF_ID = "fld_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const VALID_BODY = { encryptedData: "dGVzdA==" as EncryptedBase64 };

const FIELD_VALUE_RESULT = {
  id: "fv_550e8400-e29b-41d4-a716-446655440000" as never,
  fieldDefinitionId: FLD_DEF_ID as never,
  memberId: null,
  structureEntityId: ENTITY_ID as never,
  groupId: null,
  systemId: SYS_ID as never,
  encryptedData: "dGVzdA==" as EncryptedBase64,
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

const FIELD_PATH = `/systems/${SYS_ID}/structure/entities/${ENTITY_ID}/fields/${FLD_DEF_ID}`;

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/structure/entities/:entityId/fields/:fieldDefId", () => {
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
    const body = (await res.json()) as {
      data: {
        id: string;
        structureEntityId: string;
        version: number;
      };
    };
    expect(body.data.id).toBe("fv_550e8400-e29b-41d4-a716-446655440000");
    expect(body.data.structureEntityId).toBe(ENTITY_ID);
    expect(body.data.version).toBe(1);
  });

  it("forwards owner with kind structureEntity to service", async () => {
    vi.mocked(setFieldValueForOwner).mockResolvedValueOnce(FIELD_VALUE_RESULT);

    const app = createApp();
    await postJSON(app, FIELD_PATH, VALID_BODY);

    expect(vi.mocked(setFieldValueForOwner)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      { kind: "structureEntity", id: ENTITY_ID },
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

  it("returns 400 with issues details when schema validation fails", async () => {
    const app = createApp();
    const res = await postJSON(app, FIELD_PATH, { wrong: "shape" });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("returns 404 when structure entity not found", async () => {
    const { ApiHttpError } = await import("../../../../../lib/api-error.js");
    vi.mocked(setFieldValueForOwner).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Structure entity not found"),
    );

    const app = createApp();
    const res = await postJSON(app, FIELD_PATH, VALID_BODY);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
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
