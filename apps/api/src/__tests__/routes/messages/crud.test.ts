import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, MOCK_AUTH, postJSON, putJSON } from "../../helpers/route-test-setup.js";

import type { MessageResult } from "../../../services/message/internal.js";
import type { EncryptedBase64 } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/message/create.js", () => ({
  createMessage: vi.fn(),
}));
vi.mock("../../../services/message/queries.js", () => ({
  getMessage: vi.fn(),
  listMessages: vi.fn(),
}));
vi.mock("../../../services/message/update.js", () => ({
  updateMessage: vi.fn(),
}));
vi.mock("../../../services/message/delete.js", () => ({
  deleteMessage: vi.fn(),
}));
vi.mock("../../../services/message/lifecycle.js", () => ({
  archiveMessage: vi.fn(),
  restoreMessage: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { createMessage } = await import("../../../services/message/create.js");
const { getMessage, listMessages } = await import("../../../services/message/queries.js");
const { updateMessage } = await import("../../../services/message/update.js");
const { deleteMessage } = await import("../../../services/message/delete.js");
const { archiveMessage, restoreMessage } = await import("../../../services/message/lifecycle.js");
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
  encryptedData: "dGVzdA==" as EncryptedBase64,
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
      encryptedData: "dGVzdA==" as EncryptedBase64,
      timestamp: 1000,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(MSG_ID);
  });

  it("forwards systemId, channelId, body, auth, and audit writer to service", async () => {
    vi.mocked(createMessage).mockResolvedValueOnce(MOCK_RESULT);

    await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==" as EncryptedBase64,
      timestamp: 1000,
    });

    expect(vi.mocked(createMessage)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      CH_ID,
      expect.objectContaining({ encryptedData: "dGVzdA==" as EncryptedBase64, timestamp: 1000 }),
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 404 when channel not found", async () => {
    vi.mocked(createMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
    );

    const res = await postJSON(createApp(), BASE, {
      encryptedData: "dGVzdA==" as EncryptedBase64,
      timestamp: 1000,
    });

    expect(res.status).toBe(404);
  });
});

describe("GET /systems/:id/channels/:channelId/messages (list)", () => {
  it("returns 200 with paginated result", async () => {
    vi.mocked(listMessages).mockResolvedValueOnce({
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

describe("GET /systems/:id/channels/:channelId/messages/:messageId", () => {
  it("returns 200 with message", async () => {
    vi.mocked(getMessage).mockResolvedValueOnce(MOCK_RESULT);

    const res = await createApp().request(`${BASE}/${MSG_ID}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(MSG_ID);
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
      encryptedData: "dGVzdA==" as EncryptedBase64,
      version: 1,
    });

    expect(res.status).toBe(200);
  });

  it("returns 409 on version conflict", async () => {
    vi.mocked(updateMessage).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );

    const res = await putJSON(createApp(), `${BASE}/${MSG_ID}`, {
      encryptedData: "dGVzdA==" as EncryptedBase64,
      version: 1,
    });

    expect(res.status).toBe(409);
  });

  it("returns 404 when message not found", async () => {
    vi.mocked(updateMessage).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Message not found"),
    );

    const res = await putJSON(createApp(), `${BASE}/${MSG_ID}`, {
      encryptedData: "dGVzdA==" as EncryptedBase64,
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
    const body = (await res.json()) as { data: { version: number } };
    expect(body.data.version).toBe(3);
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
