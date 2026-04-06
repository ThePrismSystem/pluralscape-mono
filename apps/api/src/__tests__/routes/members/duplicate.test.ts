import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/member.service.js", () => ({
  duplicateMember: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../middleware/scope.js", () => mockScopeFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { duplicateMember } = await import("../../../services/member.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const MEM_ID = "mem_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const VALID_BODY = {
  encryptedData: "dGVzdA==",
  copyPhotos: false,
  copyFields: false,
  copyMemberships: false,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/members/:memberId/duplicate", () => {
  beforeEach(() => {
    vi.mocked(duplicateMember).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with duplicated member", async () => {
    vi.mocked(duplicateMember).mockResolvedValueOnce({
      id: MEM_ID as never,
      systemId: SYS_ID as never,
      encryptedData: "dGVzdA==",
      version: 1,
      createdAt: 1000 as never,
      updatedAt: 1000 as never,
      archived: false,
      archivedAt: null,
    });

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/members/${MEM_ID}/duplicate`, VALID_BODY);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; version: number } };
    expect(body.data.id).toBe(MEM_ID);
    expect(body.data.version).toBe(1);
  });

  it("forwards systemId, memberId, body, auth, and audit writer to service", async () => {
    vi.mocked(duplicateMember).mockResolvedValueOnce({
      id: MEM_ID as never,
      systemId: SYS_ID as never,
      encryptedData: "dGVzdA==",
      version: 1,
      createdAt: 1000 as never,
      updatedAt: 1000 as never,
      archived: false,
      archivedAt: null,
    });

    const app = createApp();
    await postJSON(app, `/systems/${SYS_ID}/members/${MEM_ID}/duplicate`, VALID_BODY);

    expect(vi.mocked(duplicateMember)).toHaveBeenCalledWith(
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
    const res = await app.request(`/systems/${SYS_ID}/members/${MEM_ID}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid JSON body");
  });

  it("returns 404 when source member not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(duplicateMember).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Member not found"),
    );

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/members/${MEM_ID}/duplicate`, VALID_BODY);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid member ID format", async () => {
    const app = createApp();
    const res = await postJSON(
      app,
      `/systems/${SYS_ID}/members/not-a-valid-id/duplicate`,
      VALID_BODY,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid system ID format", async () => {
    const app = createApp();
    const res = await postJSON(
      app,
      `/systems/not-a-valid-id/members/${MEM_ID}/duplicate`,
      VALID_BODY,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(duplicateMember).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/members/${MEM_ID}/duplicate`, VALID_BODY);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
