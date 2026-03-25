import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, MOCK_AUTH, postJSON, putJSON } from "../../helpers/route-test-setup.js";

import type { BoardMessageResult } from "../../../services/board-message.service.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/board-message.service.js", () => ({
  createBoardMessage: vi.fn(),
  getBoardMessage: vi.fn(),
  listBoardMessages: vi.fn(),
  updateBoardMessage: vi.fn(),
  deleteBoardMessage: vi.fn(),
  archiveBoardMessage: vi.fn(),
  restoreBoardMessage: vi.fn(),
  reorderBoardMessages: vi.fn(),
  pinBoardMessage: vi.fn(),
  unpinBoardMessage: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const {
  createBoardMessage,
  getBoardMessage,
  listBoardMessages,
  updateBoardMessage,
  deleteBoardMessage,
  archiveBoardMessage,
  restoreBoardMessage,
  reorderBoardMessages,
  pinBoardMessage,
  unpinBoardMessage,
} = await import("../../../services/board-message.service.js");
const { ApiHttpError } = await import("../../../lib/api-error.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/board-messages";
const BM_ID = "bm_550e8400-e29b-41d4-a716-446655440000";

const MOCK_RESULT: BoardMessageResult = {
  id: BM_ID as never,
  systemId: MOCK_AUTH.systemId as never,
  pinned: false,
  sortOrder: 0,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
  archived: false,
  archivedAt: null,
};

// ── Tests ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(createBoardMessage).mockReset();
  vi.mocked(getBoardMessage).mockReset();
  vi.mocked(listBoardMessages).mockReset();
  vi.mocked(updateBoardMessage).mockReset();
  vi.mocked(deleteBoardMessage).mockReset();
  vi.mocked(archiveBoardMessage).mockReset();
  vi.mocked(restoreBoardMessage).mockReset();
  vi.mocked(reorderBoardMessages).mockReset();
  vi.mocked(pinBoardMessage).mockReset();
  vi.mocked(unpinBoardMessage).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /systems/:id/board-messages (create)", () => {
  it("returns 201 with new board message on success", async () => {
    vi.mocked(createBoardMessage).mockResolvedValueOnce(MOCK_RESULT);

    const res = await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==",
      sortOrder: 0,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(BM_ID);
  });

  it("forwards systemId, body, auth, and audit writer to service", async () => {
    vi.mocked(createBoardMessage).mockResolvedValueOnce(MOCK_RESULT);

    await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==",
      sortOrder: 0,
    });

    expect(vi.mocked(createBoardMessage)).toHaveBeenCalledWith(
      expect.anything(),
      "sys_550e8400-e29b-41d4-a716-446655440000",
      expect.objectContaining({ encryptedData: "dGVzdA==", sortOrder: 0 }),
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(createBoardMessage).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==",
      sortOrder: 0,
    });

    expect(res.status).toBe(500);
  });
});

describe("GET /systems/:id/board-messages (list)", () => {
  it("returns 200 with paginated result", async () => {
    vi.mocked(listBoardMessages).mockResolvedValueOnce({
      items: [MOCK_RESULT],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });

    const res = await createApp().request(BASE);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});

describe("GET /systems/:id/board-messages/:boardMessageId", () => {
  it("returns 200 with board message", async () => {
    vi.mocked(getBoardMessage).mockResolvedValueOnce(MOCK_RESULT);

    const res = await createApp().request(`${BASE}/${BM_ID}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(BM_ID);
  });

  it("returns 404 when board message not found", async () => {
    vi.mocked(getBoardMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Board message not found"),
    );

    const res = await createApp().request(`${BASE}/${BM_ID}`);

    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(getBoardMessage).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await createApp().request(`${BASE}/${BM_ID}`);

    expect(res.status).toBe(500);
  });
});

describe("PUT /systems/:id/board-messages/:boardMessageId", () => {
  it("returns 200 with updated board message", async () => {
    vi.mocked(updateBoardMessage).mockResolvedValueOnce({ ...MOCK_RESULT, version: 2 });

    const res = await putJSON(createApp(), `${BASE}/${BM_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(200);
  });

  it("returns 409 on version conflict", async () => {
    vi.mocked(updateBoardMessage).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );

    const res = await putJSON(createApp(), `${BASE}/${BM_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(409);
  });

  it("returns 404 when board message not found", async () => {
    vi.mocked(updateBoardMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Board message not found"),
    );

    const res = await putJSON(createApp(), `${BASE}/${BM_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /systems/:id/board-messages/:boardMessageId", () => {
  it("returns 204 on success", async () => {
    vi.mocked(deleteBoardMessage).mockResolvedValueOnce(undefined);

    const res = await createApp().request(`${BASE}/${BM_ID}`, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when board message not found", async () => {
    vi.mocked(deleteBoardMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Board message not found"),
    );

    const res = await createApp().request(`${BASE}/${BM_ID}`, { method: "DELETE" });

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/board-messages/:boardMessageId/archive", () => {
  it("returns 204 on success", async () => {
    vi.mocked(archiveBoardMessage).mockResolvedValueOnce(undefined);

    const res = await postJSON(createApp(), `${BASE}/${BM_ID}/archive`, {});

    expect(res.status).toBe(204);
  });

  it("returns 409 when already archived", async () => {
    vi.mocked(archiveBoardMessage).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_ARCHIVED", "Board message is already archived"),
    );

    const res = await postJSON(createApp(), `${BASE}/${BM_ID}/archive`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when board message not found", async () => {
    vi.mocked(archiveBoardMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Board message not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${BM_ID}/archive`, {});

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/board-messages/:boardMessageId/restore", () => {
  it("returns 200 with restored board message", async () => {
    vi.mocked(restoreBoardMessage).mockResolvedValueOnce({
      ...MOCK_RESULT,
      version: 3,
    });

    const res = await postJSON(createApp(), `${BASE}/${BM_ID}/restore`, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(3);
  });

  it("returns 409 when not archived", async () => {
    vi.mocked(restoreBoardMessage).mockRejectedValueOnce(
      new ApiHttpError(409, "NOT_ARCHIVED", "Board message is not archived"),
    );

    const res = await postJSON(createApp(), `${BASE}/${BM_ID}/restore`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when board message not found", async () => {
    vi.mocked(restoreBoardMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Board message not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${BM_ID}/restore`, {});

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/board-messages/reorder", () => {
  it("returns 204 on success", async () => {
    vi.mocked(reorderBoardMessages).mockResolvedValueOnce(undefined);

    const res = await postJSON(createApp(), `${BASE}/reorder`, {
      operations: [{ boardMessageId: BM_ID, sortOrder: 0 }],
    });

    expect(res.status).toBe(204);
  });

  it("returns 400 when service throws VALIDATION_ERROR", async () => {
    vi.mocked(reorderBoardMessages).mockRejectedValueOnce(
      new ApiHttpError(400, "VALIDATION_ERROR", "Duplicate board message IDs"),
    );

    const res = await postJSON(createApp(), `${BASE}/reorder`, {
      operations: [{ boardMessageId: BM_ID, sortOrder: 0 }],
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /systems/:id/board-messages/:boardMessageId/pin", () => {
  it("returns 200 with pinned board message", async () => {
    vi.mocked(pinBoardMessage).mockResolvedValueOnce({ ...MOCK_RESULT, pinned: true });

    const res = await postJSON(createApp(), `${BASE}/${BM_ID}/pin`, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { pinned: boolean };
    expect(body.pinned).toBe(true);
  });

  it("forwards systemId, boardMessageId, auth, and audit writer to service", async () => {
    vi.mocked(pinBoardMessage).mockResolvedValueOnce({ ...MOCK_RESULT, pinned: true });

    await postJSON(createApp(), `${BASE}/${BM_ID}/pin`, {});

    expect(vi.mocked(pinBoardMessage)).toHaveBeenCalledWith(
      expect.anything(),
      "sys_550e8400-e29b-41d4-a716-446655440000",
      BM_ID,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 409 when already pinned", async () => {
    vi.mocked(pinBoardMessage).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_PINNED", "Board message is already pinned"),
    );

    const res = await postJSON(createApp(), `${BASE}/${BM_ID}/pin`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when board message not found", async () => {
    vi.mocked(pinBoardMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Board message not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${BM_ID}/pin`, {});

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/board-messages/:boardMessageId/unpin", () => {
  it("returns 200 with unpinned board message", async () => {
    vi.mocked(unpinBoardMessage).mockResolvedValueOnce(MOCK_RESULT);

    const res = await postJSON(createApp(), `${BASE}/${BM_ID}/unpin`, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { pinned: boolean };
    expect(body.pinned).toBe(false);
  });

  it("returns 409 when not pinned", async () => {
    vi.mocked(unpinBoardMessage).mockRejectedValueOnce(
      new ApiHttpError(409, "NOT_PINNED", "Board message is not pinned"),
    );

    const res = await postJSON(createApp(), `${BASE}/${BM_ID}/unpin`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when board message not found", async () => {
    vi.mocked(unpinBoardMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Board message not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${BM_ID}/unpin`, {});

    expect(res.status).toBe(404);
  });
});
