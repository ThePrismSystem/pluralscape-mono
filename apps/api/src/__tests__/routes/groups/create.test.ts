import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/group.service.js", () => ({
  createGroup: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { createGroup } = await import("../../../services/group.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups";

async function postJSON(app: Hono, body: unknown): Promise<Response> {
  return app.request(SYS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/groups", () => {
  beforeEach(() => {
    vi.mocked(createGroup).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new group on success", async () => {
    vi.mocked(createGroup).mockResolvedValueOnce({
      id: "grp_new" as never,
      systemId: MOCK_AUTH.systemId as never,
      parentGroupId: null,
      sortOrder: 0,
      encryptedData: "dGVzdA==",
      version: 1,
      createdAt: 1000 as never,
      updatedAt: 1000 as never,
      archived: false,
      archivedAt: null,
    });

    const app = createApp();
    const res = await postJSON(app, {
      encryptedData: "dGVzdA==",
      parentGroupId: null,
      sortOrder: 0,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("grp_new");
  });

  it("forwards auth and audit writer to service", async () => {
    vi.mocked(createGroup).mockResolvedValueOnce({
      id: "grp_new" as never,
      systemId: MOCK_AUTH.systemId as never,
      parentGroupId: null,
      sortOrder: 0,
      encryptedData: "dGVzdA==",
      version: 1,
      createdAt: 1000 as never,
      updatedAt: 1000 as never,
      archived: false,
      archivedAt: null,
    });

    const app = createApp();
    await postJSON(app, { encryptedData: "dGVzdA==", parentGroupId: null, sortOrder: 0 });

    expect(vi.mocked(createGroup)).toHaveBeenCalledWith(
      expect.anything(),
      "sys_550e8400-e29b-41d4-a716-446655440000",
      expect.objectContaining({ encryptedData: "dGVzdA==" }),
      MOCK_AUTH,
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(expect.anything(), MOCK_AUTH);
  });

  it("returns 400 for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(SYS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(createGroup).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, {
      encryptedData: "dGVzdA==",
      parentGroupId: null,
      sortOrder: 0,
    });

    expect(res.status).toBe(500);
  });
});
