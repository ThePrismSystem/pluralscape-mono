import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, MOCK_AUTH, postJSON } from "../../helpers/route-test-setup.js";

import type { AcknowledgementResult } from "../../../services/acknowledgement.service.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/acknowledgement.service.js", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../../services/acknowledgement.service.js")>();
  return {
    createAcknowledgement: vi.fn(),
    getAcknowledgement: vi.fn(),
    listAcknowledgements: vi.fn(),
    deleteAcknowledgement: vi.fn(),
    confirmAcknowledgement: vi.fn(),
    archiveAcknowledgement: vi.fn(),
    restoreAcknowledgement: vi.fn(),
    parseAcknowledgementQuery: original.parseAcknowledgementQuery,
  };
});

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../middleware/scope.js", () => mockScopeFactory());

// ── Imports after mocks ──────────────────────────────────────────

const {
  createAcknowledgement,
  getAcknowledgement,
  listAcknowledgements,
  deleteAcknowledgement,
  confirmAcknowledgement,
  archiveAcknowledgement,
  restoreAcknowledgement,
} = await import("../../../services/acknowledgement.service.js");
const { ApiHttpError } = await import("../../../lib/api-error.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/acknowledgements";
const ACK_ID = "ack_550e8400-e29b-41d4-a716-446655440000";

const MOCK_RESULT: AcknowledgementResult = {
  id: ACK_ID as never,
  systemId: MOCK_AUTH.systemId as never,
  createdByMemberId: null,
  confirmed: false,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
  archived: false,
  archivedAt: null,
};

// ── Tests ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(createAcknowledgement).mockReset();
  vi.mocked(getAcknowledgement).mockReset();
  vi.mocked(listAcknowledgements).mockReset();
  vi.mocked(deleteAcknowledgement).mockReset();
  vi.mocked(confirmAcknowledgement).mockReset();
  vi.mocked(archiveAcknowledgement).mockReset();
  vi.mocked(restoreAcknowledgement).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /systems/:id/acknowledgements (create)", () => {
  it("returns 201 with new acknowledgement on success", async () => {
    vi.mocked(createAcknowledgement).mockResolvedValueOnce(MOCK_RESULT);

    const res = await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==",
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(ACK_ID);
  });

  it("forwards systemId, body, auth, and audit writer to service", async () => {
    vi.mocked(createAcknowledgement).mockResolvedValueOnce(MOCK_RESULT);

    await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==",
    });

    expect(vi.mocked(createAcknowledgement)).toHaveBeenCalledWith(
      expect.anything(),
      "sys_550e8400-e29b-41d4-a716-446655440000",
      expect.objectContaining({ encryptedData: "dGVzdA==" }),
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(createAcknowledgement).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==",
    });

    expect(res.status).toBe(500);
  });
});

describe("GET /systems/:id/acknowledgements (list)", () => {
  it("returns 200 with paginated result", async () => {
    vi.mocked(listAcknowledgements).mockResolvedValueOnce({
      data: [MOCK_RESULT],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });

    const res = await createApp().request(BASE);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});

describe("GET /systems/:id/acknowledgements/:acknowledgementId", () => {
  it("returns 200 with acknowledgement", async () => {
    vi.mocked(getAcknowledgement).mockResolvedValueOnce(MOCK_RESULT);

    const res = await createApp().request(`${BASE}/${ACK_ID}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(ACK_ID);
  });

  it("returns 404 when acknowledgement not found", async () => {
    vi.mocked(getAcknowledgement).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Acknowledgement not found"),
    );

    const res = await createApp().request(`${BASE}/${ACK_ID}`);

    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(getAcknowledgement).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await createApp().request(`${BASE}/${ACK_ID}`);

    expect(res.status).toBe(500);
  });
});

describe("DELETE /systems/:id/acknowledgements/:acknowledgementId", () => {
  it("returns 204 on success", async () => {
    vi.mocked(deleteAcknowledgement).mockResolvedValueOnce(undefined);

    const res = await createApp().request(`${BASE}/${ACK_ID}`, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when acknowledgement not found", async () => {
    vi.mocked(deleteAcknowledgement).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Acknowledgement not found"),
    );

    const res = await createApp().request(`${BASE}/${ACK_ID}`, { method: "DELETE" });

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/acknowledgements/:acknowledgementId/confirm", () => {
  it("returns 200 with confirmed acknowledgement", async () => {
    vi.mocked(confirmAcknowledgement).mockResolvedValueOnce({
      ...MOCK_RESULT,
      confirmed: true,
      version: 2,
    });

    const res = await postJSON(createApp(), `${BASE}/${ACK_ID}/confirm`, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { confirmed: boolean } };
    expect(body.data.confirmed).toBe(true);
  });

  it("forwards systemId, ackId, body, auth, and audit writer to service", async () => {
    vi.mocked(confirmAcknowledgement).mockResolvedValueOnce({
      ...MOCK_RESULT,
      confirmed: true,
    });

    await postJSON(createApp(), `${BASE}/${ACK_ID}/confirm`, {});

    expect(vi.mocked(confirmAcknowledgement)).toHaveBeenCalledWith(
      expect.anything(),
      "sys_550e8400-e29b-41d4-a716-446655440000",
      ACK_ID,
      expect.anything(),
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 200 when already confirmed (idempotent)", async () => {
    vi.mocked(confirmAcknowledgement).mockResolvedValueOnce({
      ...MOCK_RESULT,
      confirmed: true,
    });

    const res = await postJSON(createApp(), `${BASE}/${ACK_ID}/confirm`, {});

    expect(res.status).toBe(200);
  });

  it("returns 404 when acknowledgement not found", async () => {
    vi.mocked(confirmAcknowledgement).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Acknowledgement not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${ACK_ID}/confirm`, {});

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/acknowledgements/:acknowledgementId/archive", () => {
  it("returns 204 on success", async () => {
    vi.mocked(archiveAcknowledgement).mockResolvedValueOnce(undefined);

    const res = await postJSON(createApp(), `${BASE}/${ACK_ID}/archive`, {});

    expect(res.status).toBe(204);
  });

  it("returns 409 when already archived", async () => {
    vi.mocked(archiveAcknowledgement).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_ARCHIVED", "Acknowledgement is already archived"),
    );

    const res = await postJSON(createApp(), `${BASE}/${ACK_ID}/archive`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when acknowledgement not found", async () => {
    vi.mocked(archiveAcknowledgement).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Acknowledgement not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${ACK_ID}/archive`, {});

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/acknowledgements/:acknowledgementId/restore", () => {
  it("returns 200 with restored acknowledgement", async () => {
    vi.mocked(restoreAcknowledgement).mockResolvedValueOnce({
      ...MOCK_RESULT,
      version: 3,
    });

    const res = await postJSON(createApp(), `${BASE}/${ACK_ID}/restore`, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { version: number } };
    expect(body.data.version).toBe(3);
  });

  it("returns 409 when not archived", async () => {
    vi.mocked(restoreAcknowledgement).mockRejectedValueOnce(
      new ApiHttpError(409, "NOT_ARCHIVED", "Acknowledgement is not archived"),
    );

    const res = await postJSON(createApp(), `${BASE}/${ACK_ID}/restore`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when acknowledgement not found", async () => {
    vi.mocked(restoreAcknowledgement).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Acknowledgement not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${ACK_ID}/restore`, {});

    expect(res.status).toBe(404);
  });
});
