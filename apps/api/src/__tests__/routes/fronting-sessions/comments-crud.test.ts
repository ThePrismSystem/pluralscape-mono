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

vi.mock("../../../services/fronting-comment.service.js", () => ({
  createFrontingComment: vi.fn(),
  listFrontingComments: vi.fn(),
  getFrontingComment: vi.fn(),
  updateFrontingComment: vi.fn(),
  deleteFrontingComment: vi.fn(),
  archiveFrontingComment: vi.fn(),
  restoreFrontingComment: vi.fn(),
}));

vi.mock("../../../services/fronting-session.service.js", () => ({
  createFrontingSession: vi.fn(),
  listFrontingSessions: vi.fn(),
  getFrontingSession: vi.fn(),
  updateFrontingSession: vi.fn(),
  endFrontingSession: vi.fn(),
  deleteFrontingSession: vi.fn(),
  archiveFrontingSession: vi.fn(),
  restoreFrontingSession: vi.fn(),
  parseFrontingSessionQuery: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const {
  createFrontingComment,
  listFrontingComments,
  getFrontingComment,
  updateFrontingComment,
  deleteFrontingComment,
  archiveFrontingComment,
  restoreFrontingComment,
} = await import("../../../services/fronting-comment.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SESSION_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/fronting-sessions/fs_660e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `${SESSION_URL}/comments`;
const COMMENT_URL = `${BASE_URL}/fcom_770e8400-e29b-41d4-a716-446655440000`;

const MOCK_COMMENT = {
  id: "fcom_770e8400-e29b-41d4-a716-446655440000" as never,
  frontingSessionId: "fs_660e8400-e29b-41d4-a716-446655440000" as never,
  systemId: MOCK_AUTH.systemId as never,
  memberId: "mem_880e8400-e29b-41d4-a716-446655440000" as never,
  customFrontId: null,
  structureEntityId: null,
  encryptedData: "dGVzdA==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

const EMPTY_PAGE = { data: [], nextCursor: null, hasMore: false, totalCount: null };

// ── Tests ────────────────────────────────────────────────────────

describe("POST .../fronting-sessions/:sessionId/comments", () => {
  beforeEach(() => {
    vi.mocked(createFrontingComment).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new comment", async () => {
    vi.mocked(createFrontingComment).mockResolvedValueOnce(MOCK_COMMENT);

    const app = createApp();
    const res = await postJSON(app, BASE_URL, {
      encryptedData: "dGVzdA==",
      memberId: "mem_880e8400-e29b-41d4-a716-446655440000",
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("fcom_770e8400-e29b-41d4-a716-446655440000");
  });

  it("returns 404 when parent session not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(createFrontingComment).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Fronting session not found"),
    );

    const app = createApp();
    const res = await postJSON(app, BASE_URL, {
      encryptedData: "dGVzdA==",
      memberId: "mem_880e8400-e29b-41d4-a716-446655440000",
    });

    expect(res.status).toBe(404);
  });

  it("returns 400 on malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid-json",
    });

    expect(res.status).toBe(400);
  });
});

describe("GET .../fronting-sessions/:sessionId/comments", () => {
  beforeEach(() => {
    vi.mocked(listFrontingComments).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listFrontingComments).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof EMPTY_PAGE;
    expect(body.data).toEqual([]);
  });

  it("passes includeArchived option to service", async () => {
    vi.mocked(listFrontingComments).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`${BASE_URL}?includeArchived=true`);

    expect(listFrontingComments).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ includeArchived: true }),
    );
  });

  it("defaults includeArchived to false", async () => {
    vi.mocked(listFrontingComments).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(BASE_URL);

    expect(listFrontingComments).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ includeArchived: false }),
    );
  });

  it("returns 404 when parent session not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(listFrontingComments).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Fronting session not found"),
    );

    const app = createApp();
    const res = await app.request(BASE_URL);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET .../comments/:commentId", () => {
  beforeEach(() => {
    vi.mocked(getFrontingComment).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with comment", async () => {
    vi.mocked(getFrontingComment).mockResolvedValueOnce(MOCK_COMMENT);

    const app = createApp();
    const res = await app.request(COMMENT_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("fcom_770e8400-e29b-41d4-a716-446655440000");
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(getFrontingComment).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Fronting comment not found"),
    );

    const app = createApp();
    const res = await app.request(COMMENT_URL);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("PUT .../comments/:commentId", () => {
  beforeEach(() => {
    vi.mocked(updateFrontingComment).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated comment", async () => {
    vi.mocked(updateFrontingComment).mockResolvedValueOnce({ ...MOCK_COMMENT, version: 2 });

    const app = createApp();
    const res = await putJSON(app, COMMENT_URL, { encryptedData: "dGVzdA==", version: 1 });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(2);
  });

  it("returns 409 on version conflict", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(updateFrontingComment).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );

    const app = createApp();
    const res = await putJSON(app, COMMENT_URL, { encryptedData: "dGVzdA==", version: 1 });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });
});

describe("DELETE .../comments/:commentId", () => {
  beforeEach(() => {
    vi.mocked(deleteFrontingComment).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteFrontingComment).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(COMMENT_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when comment not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteFrontingComment).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Fronting comment not found"),
    );

    const app = createApp();
    const res = await app.request(COMMENT_URL, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("POST .../comments/:commentId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveFrontingComment).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on archive", async () => {
    vi.mocked(archiveFrontingComment).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(`${COMMENT_URL}/archive`, { method: "POST" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when comment not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveFrontingComment).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Fronting comment not found"),
    );

    const app = createApp();
    const res = await app.request(`${COMMENT_URL}/archive`, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("POST .../comments/:commentId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreFrontingComment).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored comment", async () => {
    vi.mocked(restoreFrontingComment).mockResolvedValueOnce(MOCK_COMMENT);

    const app = createApp();
    const res = await app.request(`${COMMENT_URL}/restore`, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("fcom_770e8400-e29b-41d4-a716-446655440000");
  });

  it("returns 404 when archived comment not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(restoreFrontingComment).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Archived fronting comment not found"),
    );

    const app = createApp();
    const res = await app.request(`${COMMENT_URL}/restore`, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
