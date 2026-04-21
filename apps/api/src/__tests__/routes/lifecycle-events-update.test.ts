import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, putJSON } from "../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../services/lifecycle-event/create.js", () => ({
  createLifecycleEvent: vi.fn(),
}));

vi.mock("../../services/lifecycle-event/update.js", () => ({
  updateLifecycleEvent: vi.fn(),
}));

vi.mock("../../services/lifecycle-event/queries.js", () => ({
  listLifecycleEvents: vi.fn(),
  getLifecycleEvent: vi.fn(),
}));

vi.mock("../../services/lifecycle-event/delete.js", () => ({
  deleteLifecycleEvent: vi.fn(),
}));

vi.mock("../../services/lifecycle-event/lifecycle.js", () => ({
  archiveLifecycleEvent: vi.fn(),
  restoreLifecycleEvent: vi.fn(),
}));

vi.mock("../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../lib/db.js", () => mockDbFactory());

vi.mock("../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { updateLifecycleEvent } = await import("../../services/lifecycle-event/update.js");
const { systemRoutes } = await import("../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const EVT_ID = "evt_550e8400-e29b-41d4-a716-446655440001";

const createApp = () => createRouteApp("/systems", systemRoutes);

const EVT_URL = `/systems/${SYS_ID}/lifecycle-events/${EVT_ID}`;

const MOCK_EVENT = {
  id: EVT_ID as never,
  systemId: SYS_ID as never,
  eventType: "discovery" as const,
  occurredAt: 1000 as never,
  recordedAt: 1000 as never,
  updatedAt: 2000 as never,
  encryptedData: "dGVzdA==",
  plaintextMetadata: null,
  version: 2,
  archived: false,
  archivedAt: null,
};

const VALID_BODY = {
  encryptedData: "dGVzdA==",
  version: 1,
};

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /systems/:id/lifecycle-events/:eventId", () => {
  beforeEach(() => vi.mocked(updateLifecycleEvent).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 on success", async () => {
    vi.mocked(updateLifecycleEvent).mockResolvedValueOnce(MOCK_EVENT);
    const app = createApp();
    const res = await putJSON(app, EVT_URL, VALID_BODY);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string; version: number } };
    expect(body.data.id).toBe(EVT_ID);
    expect(body.data.version).toBe(2);
  });

  it("forwards systemId, eventId, body, auth to service", async () => {
    vi.mocked(updateLifecycleEvent).mockResolvedValueOnce(MOCK_EVENT);
    const app = createApp();
    await putJSON(app, EVT_URL, VALID_BODY);
    expect(vi.mocked(updateLifecycleEvent)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      EVT_ID,
      VALID_BODY,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(updateLifecycleEvent).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Lifecycle event not found"),
    );
    const app = createApp();
    const res = await putJSON(app, EVT_URL, VALID_BODY);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 on version conflict", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(updateLifecycleEvent).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );
    const app = createApp();
    const res = await putJSON(app, EVT_URL, VALID_BODY);
    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("returns 400 for invalid ID format", async () => {
    const app = createApp();
    const res = await putJSON(app, `/systems/${SYS_ID}/lifecycle-events/not-valid`, VALID_BODY);
    expect(res.status).toBe(400);
  });
});
