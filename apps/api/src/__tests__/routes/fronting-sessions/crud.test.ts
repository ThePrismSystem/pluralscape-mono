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

vi.mock("../../../services/fronting-session/create.js", () => ({
  createFrontingSession: vi.fn(),
}));

vi.mock("../../../services/fronting-session/queries.js", () => ({
  listFrontingSessions: vi.fn(),
  getFrontingSession: vi.fn(),
  getActiveFronting: vi.fn(),
  parseFrontingSessionQuery: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../services/fronting-session/update.js", () => ({
  updateFrontingSession: vi.fn(),
  endFrontingSession: vi.fn(),
}));

vi.mock("../../../services/fronting-session/lifecycle.js", () => ({
  deleteFrontingSession: vi.fn(),
  archiveFrontingSession: vi.fn(),
  restoreFrontingSession: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { createFrontingSession } = await import("../../../services/fronting-session/create.js");
const { listFrontingSessions, getFrontingSession } =
  await import("../../../services/fronting-session/queries.js");
const { updateFrontingSession, endFrontingSession } =
  await import("../../../services/fronting-session/update.js");
const { deleteFrontingSession, archiveFrontingSession, restoreFrontingSession } =
  await import("../../../services/fronting-session/lifecycle.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/fronting-sessions";
const FS_URL = `${BASE_URL}/fs_660e8400-e29b-41d4-a716-446655440000`;

const MOCK_SESSION = {
  id: "fs_660e8400-e29b-41d4-a716-446655440000" as never,
  systemId: MOCK_AUTH.systemId as never,
  memberId: "mem_770e8400-e29b-41d4-a716-446655440000" as never,
  customFrontId: null,
  structureEntityId: null,
  startTime: 1000 as never,
  endTime: null,
  encryptedData: "dGVzdA==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

const EMPTY_PAGE = { data: [], nextCursor: null, hasMore: false, totalCount: null };

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/fronting-sessions", () => {
  beforeEach(() => {
    vi.mocked(createFrontingSession).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new session", async () => {
    vi.mocked(createFrontingSession).mockResolvedValueOnce(MOCK_SESSION);

    const app = createApp();
    const res = await postJSON(app, BASE_URL, {
      encryptedData: "dGVzdA==",
      startTime: 1000,
      memberId: "mem_770e8400-e29b-41d4-a716-446655440000",
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("fs_660e8400-e29b-41d4-a716-446655440000");
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

describe("GET /systems/:id/fronting-sessions", () => {
  beforeEach(() => {
    vi.mocked(listFrontingSessions).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listFrontingSessions).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof EMPTY_PAGE;
    expect(body.data).toEqual([]);
  });
});

describe("GET /systems/:id/fronting-sessions/:sessionId", () => {
  beforeEach(() => {
    vi.mocked(getFrontingSession).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with session", async () => {
    vi.mocked(getFrontingSession).mockResolvedValueOnce(MOCK_SESSION);

    const app = createApp();
    const res = await app.request(FS_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("fs_660e8400-e29b-41d4-a716-446655440000");
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(getFrontingSession).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Fronting session not found"),
    );

    const app = createApp();
    const res = await app.request(FS_URL);

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

describe("PUT /systems/:id/fronting-sessions/:sessionId", () => {
  beforeEach(() => {
    vi.mocked(updateFrontingSession).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated session", async () => {
    vi.mocked(updateFrontingSession).mockResolvedValueOnce({ ...MOCK_SESSION, version: 2 });

    const app = createApp();
    const res = await putJSON(app, FS_URL, { encryptedData: "dGVzdA==", version: 1 });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { version: number } };
    expect(body.data.version).toBe(2);
  });

  it("returns 409 on version conflict", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(updateFrontingSession).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );

    const app = createApp();
    const res = await putJSON(app, FS_URL, { encryptedData: "dGVzdA==", version: 1 });

    expect(res.status).toBe(409);
  });
});

describe("POST /systems/:id/fronting-sessions/:sessionId/end", () => {
  beforeEach(() => {
    vi.mocked(endFrontingSession).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with ended session", async () => {
    vi.mocked(endFrontingSession).mockResolvedValueOnce({
      ...MOCK_SESSION,
      endTime: 2000 as never,
      version: 2,
    });

    const app = createApp();
    const res = await postJSON(app, `${FS_URL}/end`, { endTime: 2000, version: 1 });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { endTime: number } };
    expect(body.data.endTime).toBe(2000);
  });

  it("returns 400 when endTime <= startTime", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(endFrontingSession).mockRejectedValueOnce(
      new ApiHttpError(400, "VALIDATION_ERROR", "endTime must be after startTime"),
    );

    const app = createApp();
    const res = await postJSON(app, `${FS_URL}/end`, { endTime: 500, version: 1 });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /systems/:id/fronting-sessions/:sessionId", () => {
  beforeEach(() => {
    vi.mocked(deleteFrontingSession).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteFrontingSession).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(FS_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 409 when has dependents", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteFrontingSession).mockRejectedValueOnce(
      new ApiHttpError(409, "HAS_DEPENDENTS", "Fronting session has 3 comment(s)."),
    );

    const app = createApp();
    const res = await app.request(FS_URL, { method: "DELETE" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });
});

describe("POST /systems/:id/fronting-sessions/:sessionId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveFrontingSession).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on archive", async () => {
    vi.mocked(archiveFrontingSession).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(`${FS_URL}/archive`, { method: "POST" });

    expect(res.status).toBe(204);
  });
});

describe("POST /systems/:id/fronting-sessions/:sessionId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreFrontingSession).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored session", async () => {
    vi.mocked(restoreFrontingSession).mockResolvedValueOnce(MOCK_SESSION);

    const app = createApp();
    const res = await app.request(`${FS_URL}/restore`, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("fs_660e8400-e29b-41d4-a716-446655440000");
  });
});

describe("rate limits", () => {
  it("applies readDefault and write rate limit categories", () => {
    const calls = vi.mocked(createCategoryRateLimiter).mock.calls.map((c) => c[0]);
    expect(calls).toContain("readDefault");
    expect(calls).toContain("write");
  });
});
