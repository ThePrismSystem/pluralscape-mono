import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON } from "../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../services/lifecycle-event.service.js", () => ({
  createLifecycleEvent: vi.fn(),
  listLifecycleEvents: vi.fn(),
  getLifecycleEvent: vi.fn(),
}));

vi.mock("../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../lib/db.js", () => mockDbFactory());

vi.mock("../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createLifecycleEvent, listLifecycleEvents, getLifecycleEvent } =
  await import("../../services/lifecycle-event.service.js");
const { systemRoutes } = await import("../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const EVT_ID = "evt_550e8400-e29b-41d4-a716-446655440001";

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = `/systems/${SYS_ID}/lifecycle-events`;

const MOCK_EVENT = {
  id: EVT_ID as never,
  systemId: SYS_ID as never,
  eventType: "created",
  occurredAt: 1000 as never,
  recordedAt: 1000 as never,
  encryptedData: "dGVzdA==",
  plaintextMetadata: null,
};

const MOCK_PAGINATED = {
  items: [MOCK_EVENT],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

const VALID_BODY = { encryptedData: "dGVzdA==" };

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/lifecycle-events", () => {
  beforeEach(() => vi.mocked(createLifecycleEvent).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 201 on success", async () => {
    vi.mocked(createLifecycleEvent).mockResolvedValueOnce(MOCK_EVENT);
    const app = createApp();
    const res = await postJSON(app, BASE_URL, VALID_BODY);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(EVT_ID);
  });

  it("forwards systemId, body, auth to service", async () => {
    vi.mocked(createLifecycleEvent).mockResolvedValueOnce(MOCK_EVENT);
    const app = createApp();
    await postJSON(app, BASE_URL, VALID_BODY);
    expect(vi.mocked(createLifecycleEvent)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      VALID_BODY,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 404 when service throws NOT_FOUND", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(createLifecycleEvent).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Not found"),
    );
    const app = createApp();
    const res = await postJSON(app, BASE_URL, VALID_BODY);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(createLifecycleEvent).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp();
    const res = await postJSON(app, BASE_URL, VALID_BODY);
    expect(res.status).toBe(500);
  });
});

describe("GET /systems/:id/lifecycle-events", () => {
  beforeEach(() => vi.mocked(listLifecycleEvents).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with paginated list", async () => {
    vi.mocked(listLifecycleEvents).mockResolvedValueOnce(MOCK_PAGINATED);
    const app = createApp();
    const res = await app.request(BASE_URL);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it("forwards systemId and auth to service", async () => {
    vi.mocked(listLifecycleEvents).mockResolvedValueOnce(MOCK_PAGINATED);
    const app = createApp();
    await app.request(BASE_URL);
    expect(vi.mocked(listLifecycleEvents)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      undefined,
      expect.any(Number),
      undefined,
    );
  });
});

describe("GET /systems/:id/lifecycle-events/:eventId", () => {
  beforeEach(() => vi.mocked(getLifecycleEvent).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with event", async () => {
    vi.mocked(getLifecycleEvent).mockResolvedValueOnce(MOCK_EVENT);
    const app = createApp();
    const res = await app.request(`${BASE_URL}/${EVT_ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(EVT_ID);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(getLifecycleEvent).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Lifecycle event not found"),
    );
    const app = createApp();
    const res = await app.request(`${BASE_URL}/${EVT_ID}`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
