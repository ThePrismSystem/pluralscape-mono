import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, putJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/member/update.js", () => ({
  updateMember: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { updateMember } = await import("../../../services/member/update.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const MEM_ID = "mem_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const VALID_BODY = { encryptedData: "dGVzdA==", version: 1 };

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /systems/:systemId/members/:memberId", () => {
  beforeEach(() => {
    vi.mocked(updateMember).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated member", async () => {
    vi.mocked(updateMember).mockResolvedValueOnce({
      id: MEM_ID as never,
      systemId: SYS_ID as never,
      encryptedData: "dGVzdA==",
      version: 2,
      createdAt: 1000 as never,
      updatedAt: 2000 as never,
      archived: false,
      archivedAt: null,
    });

    const app = createApp();
    const res = await putJSON(app, `/systems/${SYS_ID}/members/${MEM_ID}`, VALID_BODY);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string; version: number } };
    expect(body.data.id).toBe(MEM_ID);
    expect(body.data.version).toBe(2);
  });

  it("forwards systemId, memberId, body, auth, and audit writer to service", async () => {
    vi.mocked(updateMember).mockResolvedValueOnce({
      id: MEM_ID as never,
      systemId: SYS_ID as never,
      encryptedData: "dGVzdA==",
      version: 2,
      createdAt: 1000 as never,
      updatedAt: 2000 as never,
      archived: false,
      archivedAt: null,
    });

    const app = createApp();
    await putJSON(app, `/systems/${SYS_ID}/members/${MEM_ID}`, VALID_BODY);

    expect(vi.mocked(updateMember)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MEM_ID,
      VALID_BODY,
      MOCK_AUTH,
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(expect.anything(), MOCK_AUTH);
  });

  it("returns 400 for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/members/${MEM_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid JSON body");
  });

  it("returns 404 when member not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(updateMember).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Member not found"),
    );

    const app = createApp();
    const res = await putJSON(app, `/systems/${SYS_ID}/members/${MEM_ID}`, VALID_BODY);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 on version conflict", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(updateMember).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );

    const app = createApp();
    const res = await putJSON(app, `/systems/${SYS_ID}/members/${MEM_ID}`, VALID_BODY);

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("returns 400 for validation error from service", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(updateMember).mockRejectedValueOnce(
      new ApiHttpError(400, "VALIDATION_ERROR", "Invalid blob"),
    );

    const app = createApp();
    const res = await putJSON(app, `/systems/${SYS_ID}/members/${MEM_ID}`, VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid member ID format", async () => {
    const app = createApp();
    const res = await putJSON(app, `/systems/${SYS_ID}/members/not-a-valid-id`, VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(updateMember).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await putJSON(app, `/systems/${SYS_ID}/members/${MEM_ID}`, VALID_BODY);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
