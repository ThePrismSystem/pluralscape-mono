import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON, putJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/timer-config.service.js", () => ({
  createTimerConfig: vi.fn(),
  listTimerConfigs: vi.fn(),
  getTimerConfig: vi.fn(),
  updateTimerConfig: vi.fn(),
  deleteTimerConfig: vi.fn(),
  archiveTimerConfig: vi.fn(),
  restoreTimerConfig: vi.fn(),
  parseTimerConfigQuery: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const {
  createTimerConfig,
  listTimerConfigs,
  getTimerConfig,
  updateTimerConfig,
  deleteTimerConfig,
  archiveTimerConfig,
  restoreTimerConfig,
} = await import("../../../services/timer-config.service.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/timer-configs";
const TIMER_URL = `${BASE_URL}/tmr_660e8400-e29b-41d4-a716-446655440000`;

const MOCK_TIMER = {
  id: "tmr_660e8400-e29b-41d4-a716-446655440000" as never,
  systemId: MOCK_AUTH.systemId as never,
  enabled: true,
  intervalMinutes: 30,
  wakingHoursOnly: false as const,
  wakingStart: null,
  wakingEnd: null,
  encryptedData: "dGVzdA==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

const EMPTY_PAGE = { items: [], nextCursor: null, hasMore: false, totalCount: null };

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/timer-configs", () => {
  beforeEach(() => {
    vi.mocked(createTimerConfig).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new timer config", async () => {
    vi.mocked(createTimerConfig).mockResolvedValueOnce(MOCK_TIMER);

    const app = createApp();
    const res = await postJSON(app, BASE_URL, {
      encryptedData: "dGVzdA==",
      intervalMinutes: 30,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("tmr_660e8400-e29b-41d4-a716-446655440000");
  });

  it("returns 400 for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });
});

describe("GET /systems/:id/timer-configs", () => {
  beforeEach(() => {
    vi.mocked(listTimerConfigs).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listTimerConfigs).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof EMPTY_PAGE;
    expect(body.items).toEqual([]);
  });
});

describe("GET /systems/:id/timer-configs/:timerId", () => {
  beforeEach(() => {
    vi.mocked(getTimerConfig).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with timer config", async () => {
    vi.mocked(getTimerConfig).mockResolvedValueOnce(MOCK_TIMER);

    const app = createApp();
    const res = await app.request(TIMER_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("tmr_660e8400-e29b-41d4-a716-446655440000");
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(getTimerConfig).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Timer config not found"),
    );

    const app = createApp();
    const res = await app.request(TIMER_URL);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid ID format", async () => {
    const app = createApp();
    const res = await app.request(`${BASE_URL}/not-valid`);

    expect(res.status).toBe(400);
  });
});

describe("PUT /systems/:id/timer-configs/:timerId", () => {
  beforeEach(() => {
    vi.mocked(updateTimerConfig).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated timer config", async () => {
    vi.mocked(updateTimerConfig).mockResolvedValueOnce({ ...MOCK_TIMER, version: 2 });

    const app = createApp();
    const res = await putJSON(app, TIMER_URL, { encryptedData: "dGVzdA==", version: 1 });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(2);
  });

  it("returns 409 on version conflict", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(updateTimerConfig).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );

    const app = createApp();
    const res = await putJSON(app, TIMER_URL, { encryptedData: "dGVzdA==", version: 1 });

    expect(res.status).toBe(409);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(updateTimerConfig).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Timer config not found"),
    );
    const app = createApp();
    const res = await putJSON(app, TIMER_URL, { encryptedData: "dGVzdA==", version: 1 });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /systems/:id/timer-configs/:timerId", () => {
  beforeEach(() => {
    vi.mocked(deleteTimerConfig).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteTimerConfig).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(TIMER_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 409 when has dependents", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteTimerConfig).mockRejectedValueOnce(
      new ApiHttpError(409, "HAS_DEPENDENTS", "Timer config has 3 check-in record(s)."),
    );

    const app = createApp();
    const res = await app.request(TIMER_URL, { method: "DELETE" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteTimerConfig).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Timer config not found"),
    );
    const app = createApp();
    const res = await app.request(TIMER_URL, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/timer-configs/:timerId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveTimerConfig).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on archive", async () => {
    vi.mocked(archiveTimerConfig).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(`${TIMER_URL}/archive`, { method: "POST" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveTimerConfig).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Timer config not found"),
    );
    const app = createApp();
    const res = await app.request(`${TIMER_URL}/archive`, { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("returns 409 when already archived", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveTimerConfig).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_ARCHIVED", "Timer config is already archived"),
    );
    const app = createApp();
    const res = await app.request(`${TIMER_URL}/archive`, { method: "POST" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("ALREADY_ARCHIVED");
  });
});

describe("POST /systems/:id/timer-configs/:timerId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreTimerConfig).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored timer config", async () => {
    vi.mocked(restoreTimerConfig).mockResolvedValueOnce(MOCK_TIMER);

    const app = createApp();
    const res = await app.request(`${TIMER_URL}/restore`, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("tmr_660e8400-e29b-41d4-a716-446655440000");
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(restoreTimerConfig).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Timer config not found"),
    );
    const app = createApp();
    const res = await app.request(`${TIMER_URL}/restore`, { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("returns 409 when not archived", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(restoreTimerConfig).mockRejectedValueOnce(
      new ApiHttpError(409, "NOT_ARCHIVED", "Timer config is not archived"),
    );
    const app = createApp();
    const res = await app.request(`${TIMER_URL}/restore`, { method: "POST" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_ARCHIVED");
  });
});

describe("rate limits", () => {
  it("applies readDefault and write rate limit categories", () => {
    const calls = vi.mocked(createCategoryRateLimiter).mock.calls.map((c) => c[0]);
    expect(calls).toContain("readDefault");
    expect(calls).toContain("write");
  });
});
