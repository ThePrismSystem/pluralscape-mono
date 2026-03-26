import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, MOCK_AUTH, postJSON, putJSON } from "../../helpers/route-test-setup.js";

import type { MessageResult } from "../../../services/message.service.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/message.service.js", () => ({
  createMessage: vi.fn(),
  getMessage: vi.fn(),
  listMessages: vi.fn(),
  updateMessage: vi.fn(),
  deleteMessage: vi.fn(),
  archiveMessage: vi.fn(),
  restoreMessage: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const {
  createMessage,
  getMessage,
  listMessages,
  updateMessage,
  deleteMessage,
  archiveMessage,
  restoreMessage,
} = await import("../../../services/message.service.js");
const { ApiHttpError } = await import("../../../lib/api-error.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const CH_ID = "ch_550e8400-e29b-41d4-a716-446655440000";
const MSG_ID = "msg_550e8400-e29b-41d4-a716-446655440000";
// Messages are nested under channels: /systems/:systemId/channels/:channelId/messages
const BASE = `/systems/${SYS_ID}/channels/${CH_ID}/messages`;

const MOCK_RESULT: MessageResult = {
  id: MSG_ID as never,
  channelId: CH_ID as never,
  systemId: MOCK_AUTH.systemId as never,
  replyToId: null,
  timestamp: 1000 as never,
  editedAt: null,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
  archived: false,
  archivedAt: null,
};

// ── Tests ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(createMessage).mockReset();
  vi.mocked(getMessage).mockReset();
  vi.mocked(listMessages).mockReset();
  vi.mocked(updateMessage).mockReset();
  vi.mocked(deleteMessage).mockReset();
  vi.mocked(archiveMessage).mockReset();
  vi.mocked(restoreMessage).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /systems/:id/channels/:channelId/messages (create)", () => {
  it("returns 201 with new message on success", async () => {
    vi.mocked(createMessage).mockResolvedValueOnce(MOCK_RESULT);

    const res = await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==",
      timestamp: 1000,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(MSG_ID);
  });

  it("forwards systemId, channelId, body, auth, and audit writer to service", async () => {
    vi.mocked(createMessage).mockResolvedValueOnce(MOCK_RESULT);

    await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==",
      timestamp: 1000,
    });

    expect(vi.mocked(createMessage)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      CH_ID,
      expect.objectContaining({ encryptedData: "dGVzdA==", timestamp: 1000 }),
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 404 when channel not found", async () => {
    vi.mocked(createMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
    );

    const res = await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==",
      timestamp: 1000,
    });

    expect(res.status).toBe(404);
  });
});

describe("GET /systems/:id/channels/:channelId/messages (list)", () => {
  it("returns 200 with paginated result", async () => {
    vi.mocked(listMessages).mockResolvedValueOnce({
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

describe("GET /systems/:id/channels/:channelId/messages/:messageId", () => {
  it("returns 200 with message", async () => {
    vi.mocked(getMessage).mockResolvedValueOnce(MOCK_RESULT);

    const res = await createApp().request(`${BASE}/${MSG_ID}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(MSG_ID);
  });

  it("returns 404 when message not found", async () => {
    vi.mocked(getMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Message not found"),
    );

    const res = await createApp().request(`${BASE}/${MSG_ID}`);

    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(getMessage).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await createApp().request(`${BASE}/${MSG_ID}`);

    expect(res.status).toBe(500);
  });
});

describe("PUT /systems/:id/channels/:channelId/messages/:messageId", () => {
  it("returns 200 with updated message", async () => {
    vi.mocked(updateMessage).mockResolvedValueOnce({ ...MOCK_RESULT, version: 2 });

    const res = await putJSON(createApp(), `${BASE}/${MSG_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(200);
  });

  it("returns 409 on version conflict", async () => {
    vi.mocked(updateMessage).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );

    const res = await putJSON(createApp(), `${BASE}/${MSG_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(409);
  });

  it("returns 404 when message not found", async () => {
    vi.mocked(updateMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Message not found"),
    );

    const res = await putJSON(createApp(), `${BASE}/${MSG_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /systems/:id/channels/:channelId/messages/:messageId", () => {
  it("returns 204 on success", async () => {
    vi.mocked(deleteMessage).mockResolvedValueOnce(undefined);

    const res = await createApp().request(`${BASE}/${MSG_ID}`, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when message not found", async () => {
    vi.mocked(deleteMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Message not found"),
    );

    const res = await createApp().request(`${BASE}/${MSG_ID}`, { method: "DELETE" });

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/channels/:channelId/messages/:messageId/archive", () => {
  it("returns 204 on success", async () => {
    vi.mocked(archiveMessage).mockResolvedValueOnce(undefined);

    const res = await postJSON(createApp(), `${BASE}/${MSG_ID}/archive`, {});

    expect(res.status).toBe(204);
  });

  it("returns 409 when already archived", async () => {
    vi.mocked(archiveMessage).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_ARCHIVED", "Message is already archived"),
    );

    const res = await postJSON(createApp(), `${BASE}/${MSG_ID}/archive`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when message not found", async () => {
    vi.mocked(archiveMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Message not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${MSG_ID}/archive`, {});

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/channels/:channelId/messages/:messageId/restore", () => {
  it("returns 200 with restored message", async () => {
    vi.mocked(restoreMessage).mockResolvedValueOnce({
      ...MOCK_RESULT,
      version: 3,
    });

    const res = await postJSON(createApp(), `${BASE}/${MSG_ID}/restore`, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(3);
  });

  it("returns 409 when not archived", async () => {
    vi.mocked(restoreMessage).mockRejectedValueOnce(
      new ApiHttpError(409, "NOT_ARCHIVED", "Message is not archived"),
    );

    const res = await postJSON(createApp(), `${BASE}/${MSG_ID}/restore`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when message not found", async () => {
    vi.mocked(restoreMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Message not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${MSG_ID}/restore`, {});

    expect(res.status).toBe(404);
  });
});
