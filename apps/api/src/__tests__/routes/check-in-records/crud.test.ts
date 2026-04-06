import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/check-in-record.service.js", () => ({
  createCheckInRecord: vi.fn(),
  listCheckInRecords: vi.fn(),
  getCheckInRecord: vi.fn(),
  respondCheckInRecord: vi.fn(),
  dismissCheckInRecord: vi.fn(),
  archiveCheckInRecord: vi.fn(),
  deleteCheckInRecord: vi.fn(),
  parseCheckInRecordQuery: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../middleware/scope.js", () => mockScopeFactory());

// ── Imports after mocks ──────────────────────────────────────────

const {
  createCheckInRecord,
  listCheckInRecords,
  getCheckInRecord,
  respondCheckInRecord,
  dismissCheckInRecord,
  archiveCheckInRecord,
  deleteCheckInRecord,
} = await import("../../../services/check-in-record.service.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/check-in-records";
const RECORD_URL = `${BASE_URL}/cir_660e8400-e29b-41d4-a716-446655440000`;

const MOCK_RECORD = {
  id: "cir_660e8400-e29b-41d4-a716-446655440000" as never,
  systemId: MOCK_AUTH.systemId as never,
  timerConfigId: "tmr_770e8400-e29b-41d4-a716-446655440000" as never,
  scheduledAt: 1000 as never,
  status: "pending" as const,
  respondedByMemberId: null,
  respondedAt: null,
  dismissed: false as const,
  encryptedData: null,
  archived: false,
  archivedAt: null,
};

const EMPTY_PAGE = { data: [], nextCursor: null, hasMore: false, totalCount: null };

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/check-in-records", () => {
  beforeEach(() => {
    vi.mocked(createCheckInRecord).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new check-in record", async () => {
    vi.mocked(createCheckInRecord).mockResolvedValueOnce(MOCK_RECORD);

    const app = createApp();
    const res = await postJSON(app, BASE_URL, {
      timerConfigId: "tmr_770e8400-e29b-41d4-a716-446655440000",
      scheduledAt: 1000,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("cir_660e8400-e29b-41d4-a716-446655440000");
  });
});

describe("GET /systems/:id/check-in-records", () => {
  beforeEach(() => {
    vi.mocked(listCheckInRecords).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listCheckInRecords).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof EMPTY_PAGE;
    expect(body.data).toEqual([]);
  });
});

describe("GET /systems/:id/check-in-records/:recordId", () => {
  beforeEach(() => {
    vi.mocked(getCheckInRecord).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with record", async () => {
    vi.mocked(getCheckInRecord).mockResolvedValueOnce(MOCK_RECORD);

    const app = createApp();
    const res = await app.request(RECORD_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("cir_660e8400-e29b-41d4-a716-446655440000");
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(getCheckInRecord).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Check-in record not found"),
    );

    const app = createApp();
    const res = await app.request(RECORD_URL);

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

describe("POST /systems/:id/check-in-records/:recordId/respond", () => {
  beforeEach(() => {
    vi.mocked(respondCheckInRecord).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with responded record", async () => {
    vi.mocked(respondCheckInRecord).mockResolvedValueOnce({
      ...MOCK_RECORD,
      status: "responded" as const,
      respondedByMemberId: "mem_880e8400-e29b-41d4-a716-446655440000" as never,
      respondedAt: 2000 as never,
    });

    const app = createApp();
    const res = await postJSON(app, `${RECORD_URL}/respond`, {
      respondedByMemberId: "mem_880e8400-e29b-41d4-a716-446655440000",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { respondedAt: number } };
    expect(body.data.respondedAt).toBe(2000);
  });

  it("returns 409 when already responded", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(respondCheckInRecord).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_RESPONDED", "Check-in already responded"),
    );

    const app = createApp();
    const res = await postJSON(app, `${RECORD_URL}/respond`, {
      respondedByMemberId: "mem_880e8400-e29b-41d4-a716-446655440000",
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("ALREADY_RESPONDED");
  });

  it("returns 409 when record is dismissed", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(respondCheckInRecord).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_DISMISSED", "Check-in already dismissed"),
    );
    const app = createApp();
    const res = await postJSON(app, `${RECORD_URL}/respond`, {
      respondedByMemberId: "mem_880e8400-e29b-41d4-a716-446655440000",
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("ALREADY_DISMISSED");
  });

  it("returns 400 for invalid member", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(respondCheckInRecord).mockRejectedValueOnce(
      new ApiHttpError(400, "VALIDATION_ERROR", "Member not found in system"),
    );
    const app = createApp();
    const res = await postJSON(app, `${RECORD_URL}/respond`, {
      respondedByMemberId: "mem_880e8400-e29b-41d4-a716-446655440000",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /systems/:id/check-in-records/:recordId/dismiss", () => {
  beforeEach(() => {
    vi.mocked(dismissCheckInRecord).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with dismissed record", async () => {
    vi.mocked(dismissCheckInRecord).mockResolvedValueOnce({
      id: MOCK_RECORD.id,
      systemId: MOCK_RECORD.systemId,
      timerConfigId: MOCK_RECORD.timerConfigId,
      scheduledAt: MOCK_RECORD.scheduledAt,
      encryptedData: MOCK_RECORD.encryptedData,
      archived: MOCK_RECORD.archived,
      archivedAt: MOCK_RECORD.archivedAt,
      status: "dismissed" as const,
      respondedByMemberId: null,
      respondedAt: null,
      dismissed: true as const,
    });

    const app = createApp();
    const res = await app.request(`${RECORD_URL}/dismiss`, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { dismissed: boolean } };
    expect(body.data.dismissed).toBe(true);
  });

  it("returns 409 when already dismissed", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(dismissCheckInRecord).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_DISMISSED", "Check-in already dismissed"),
    );

    const app = createApp();
    const res = await app.request(`${RECORD_URL}/dismiss`, { method: "POST" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("ALREADY_DISMISSED");
  });

  it("returns 409 when record is already responded", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(dismissCheckInRecord).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_RESPONDED", "Check-in already responded"),
    );
    const app = createApp();
    const res = await app.request(`${RECORD_URL}/dismiss`, { method: "POST" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("ALREADY_RESPONDED");
  });
});

describe("POST /systems/:id/check-in-records/:recordId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveCheckInRecord).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on archive", async () => {
    vi.mocked(archiveCheckInRecord).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(`${RECORD_URL}/archive`, { method: "POST" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveCheckInRecord).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Check-in record not found"),
    );
    const app = createApp();
    const res = await app.request(`${RECORD_URL}/archive`, { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("returns 409 when already archived", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveCheckInRecord).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_ARCHIVED", "Check-in record is already archived"),
    );
    const app = createApp();
    const res = await app.request(`${RECORD_URL}/archive`, { method: "POST" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("ALREADY_ARCHIVED");
  });
});

describe("DELETE /systems/:id/check-in-records/:recordId", () => {
  beforeEach(() => {
    vi.mocked(deleteCheckInRecord).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteCheckInRecord).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(RECORD_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteCheckInRecord).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Check-in record not found"),
    );
    const app = createApp();
    const res = await app.request(RECORD_URL, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

describe("rate limits", () => {
  it("applies readDefault and write rate limit categories", () => {
    const calls = vi.mocked(createCategoryRateLimiter).mock.calls.map((c) => c[0]);
    expect(calls).toContain("readDefault");
    expect(calls).toContain("write");
  });
});
