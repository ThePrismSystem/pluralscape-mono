import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/member.service.js", () => ({
  createMember: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { createMember } = await import("../../../services/member.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const VALID_BODY = { encryptedData: "dGVzdA==" };

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/members", () => {
  beforeEach(() => {
    vi.mocked(createMember).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new member on success", async () => {
    vi.mocked(createMember).mockResolvedValueOnce({
      id: "mem_new" as never,
      systemId: SYS_ID as never,
      encryptedData: "dGVzdA==",
      version: 1,
      createdAt: 1000 as never,
      updatedAt: 1000 as never,
      archived: false,
      archivedAt: null,
    });

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/members`, VALID_BODY);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; version: number } };
    expect(body.data.id).toBe("mem_new");
    expect(body.data.version).toBe(1);
  });

  it("forwards systemId, body, auth, and audit writer to service", async () => {
    vi.mocked(createMember).mockResolvedValueOnce({
      id: "mem_new" as never,
      systemId: SYS_ID as never,
      encryptedData: "dGVzdA==",
      version: 1,
      createdAt: 1000 as never,
      updatedAt: 1000 as never,
      archived: false,
      archivedAt: null,
    });

    const app = createApp();
    await postJSON(app, `/systems/${SYS_ID}/members`, VALID_BODY);

    expect(vi.mocked(createMember)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      VALID_BODY,
      MOCK_AUTH,
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(expect.anything(), MOCK_AUTH);
  });

  it("returns 400 for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when system not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(createMember).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "System not found"),
    );

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/members`, VALID_BODY);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid system ID format", async () => {
    const app = createApp();
    const res = await postJSON(app, "/systems/not-a-valid-id/members", VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(createMember).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/members`, VALID_BODY);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
