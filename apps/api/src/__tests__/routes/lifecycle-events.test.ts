import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON } from "../helpers/route-test-setup.js";

import type { EncryptedBase64, ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../services/lifecycle-event/create.js", () => ({
  createLifecycleEvent: vi.fn(),
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

const { createLifecycleEvent } = await import("../../services/lifecycle-event/create.js");
const { listLifecycleEvents, getLifecycleEvent } =
  await import("../../services/lifecycle-event/queries.js");
const { deleteLifecycleEvent } = await import("../../services/lifecycle-event/delete.js");
const { archiveLifecycleEvent, restoreLifecycleEvent } =
  await import("../../services/lifecycle-event/lifecycle.js");
const { createCategoryRateLimiter } = await import("../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const EVT_ID = "evt_550e8400-e29b-41d4-a716-446655440001";

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = `/systems/${SYS_ID}/lifecycle-events`;
const EVT_URL = `${BASE_URL}/${EVT_ID}`;

const MOCK_EVENT = {
  id: EVT_ID as never,
  systemId: SYS_ID as never,
  eventType: "discovery" as const,
  occurredAt: 1000 as never,
  recordedAt: 1000 as never,
  updatedAt: 1000 as never,
  encryptedData: "dGVzdA==" as EncryptedBase64,
  plaintextMetadata: null,
  version: 1,
  archived: false,
  archivedAt: null,
};

const MOCK_PAGINATED = {
  data: [MOCK_EVENT],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

const VALID_BODY = {
  eventType: "discovery" as const,
  occurredAt: 1000,
  encryptedData: "dGVzdA==" as EncryptedBase64,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/lifecycle-events", () => {
  beforeEach(() => vi.mocked(createLifecycleEvent).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 201 on success", async () => {
    vi.mocked(createLifecycleEvent).mockResolvedValueOnce(MOCK_EVENT);
    const app = createApp();
    const res = await postJSON(app, BASE_URL, VALID_BODY);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(EVT_ID);
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
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
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
      false,
    );
  });

  it("forwards valid eventType to service", async () => {
    vi.mocked(listLifecycleEvents).mockResolvedValueOnce(MOCK_PAGINATED);
    const app = createApp();
    await app.request(`${BASE_URL}?eventType=discovery`);
    expect(vi.mocked(listLifecycleEvents)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      undefined,
      expect.any(Number),
      "discovery",
      false,
    );
  });

  it("passes includeArchived=true to service", async () => {
    vi.mocked(listLifecycleEvents).mockResolvedValueOnce(MOCK_PAGINATED);
    const app = createApp();
    await app.request(`${BASE_URL}?includeArchived=true`);
    expect(vi.mocked(listLifecycleEvents)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      undefined,
      expect.any(Number),
      undefined,
      true,
    );
  });

  it("returns 400 for invalid eventType", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const app = createApp();
    const res = await app.request(`${BASE_URL}?eventType=invalid-type`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid includeArchived value", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const app = createApp();
    const res = await app.request(`${BASE_URL}?includeArchived=yes`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });
});

describe("GET /systems/:id/lifecycle-events/:eventId", () => {
  beforeEach(() => vi.mocked(getLifecycleEvent).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with event", async () => {
    vi.mocked(getLifecycleEvent).mockResolvedValueOnce(MOCK_EVENT);
    const app = createApp();
    const res = await app.request(EVT_URL);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(EVT_ID);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(getLifecycleEvent).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Lifecycle event not found"),
    );
    const app = createApp();
    const res = await app.request(EVT_URL);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("DELETE /systems/:id/lifecycle-events/:eventId", () => {
  beforeEach(() => vi.mocked(deleteLifecycleEvent).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(deleteLifecycleEvent).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(EVT_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(deleteLifecycleEvent).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Lifecycle event not found"),
    );

    const app = createApp();
    const res = await app.request(EVT_URL, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("forwards systemId, eventId, auth to service", async () => {
    vi.mocked(deleteLifecycleEvent).mockResolvedValueOnce(undefined);

    const app = createApp();
    await app.request(EVT_URL, { method: "DELETE" });

    expect(vi.mocked(deleteLifecycleEvent)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      EVT_ID,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(deleteLifecycleEvent).mockRejectedValueOnce(new Error("DB timeout"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp();
    const res = await app.request(EVT_URL, { method: "DELETE" });
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe("POST /systems/:id/lifecycle-events/:eventId/archive", () => {
  beforeEach(() => vi.mocked(archiveLifecycleEvent).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 204 on archive", async () => {
    vi.mocked(archiveLifecycleEvent).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(`${EVT_URL}/archive`, { method: "POST" });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(archiveLifecycleEvent).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Lifecycle event not found"),
    );

    const app = createApp();
    const res = await app.request(`${EVT_URL}/archive`, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("forwards systemId, eventId, auth to service", async () => {
    vi.mocked(archiveLifecycleEvent).mockResolvedValueOnce(undefined);

    const app = createApp();
    await app.request(`${EVT_URL}/archive`, { method: "POST" });

    expect(vi.mocked(archiveLifecycleEvent)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      EVT_ID,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(archiveLifecycleEvent).mockRejectedValueOnce(new Error("DB timeout"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp();
    const res = await app.request(`${EVT_URL}/archive`, { method: "POST" });
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe("POST /systems/:id/lifecycle-events/:eventId/restore", () => {
  beforeEach(() => vi.mocked(restoreLifecycleEvent).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with restored event", async () => {
    vi.mocked(restoreLifecycleEvent).mockResolvedValueOnce(MOCK_EVENT);

    const app = createApp();
    const res = await app.request(`${EVT_URL}/restore`, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(EVT_ID);
  });

  it("returns 404 when archived event not found", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(restoreLifecycleEvent).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Archived lifecycle event not found"),
    );

    const app = createApp();
    const res = await app.request(`${EVT_URL}/restore`, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("forwards systemId, eventId, auth to service", async () => {
    vi.mocked(restoreLifecycleEvent).mockResolvedValueOnce(MOCK_EVENT);

    const app = createApp();
    await app.request(`${EVT_URL}/restore`, { method: "POST" });

    expect(vi.mocked(restoreLifecycleEvent)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      EVT_ID,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(restoreLifecycleEvent).mockRejectedValueOnce(new Error("DB timeout"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp();
    const res = await app.request(`${EVT_URL}/restore`, { method: "POST" });
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});

describe("rate limits", () => {
  it("applies readDefault and write rate limit categories", () => {
    const calls = vi.mocked(createCategoryRateLimiter).mock.calls.map((c) => c[0]);
    expect(calls).toContain("readDefault");
    expect(calls).toContain("write");
  });
});
