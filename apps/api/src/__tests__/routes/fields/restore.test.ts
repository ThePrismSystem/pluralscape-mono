import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { EncryptedBase64, ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/field-definition/restore.js", () => ({
  restoreFieldDefinition: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { restoreFieldDefinition } = await import("../../../services/field-definition/restore.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const FLD_ID = "fld_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const FIELD_DEFINITION_RESULT = {
  id: FLD_ID as never,
  systemId: SYS_ID as never,
  fieldType: "text" as const,
  required: false,
  sortOrder: 0,
  encryptedData: "dGVzdA==" as EncryptedBase64,
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
  archived: false,
  archivedAt: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/fields/:fieldId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreFieldDefinition).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored field definition result", async () => {
    vi.mocked(restoreFieldDefinition).mockResolvedValueOnce(FIELD_DEFINITION_RESULT);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields/${FLD_ID}/restore`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string; fieldType: string; version: number } };
    expect(body.data.id).toBe(FLD_ID);
    expect(body.data.fieldType).toBe("text");
    expect(body.data.version).toBe(1);
  });

  it("returns 404 when field not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(restoreFieldDefinition).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Field definition not found"),
    );

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields/${FLD_ID}/restore`, {
      method: "POST",
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(restoreFieldDefinition).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/fields/${FLD_ID}/restore`, {
      method: "POST",
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
