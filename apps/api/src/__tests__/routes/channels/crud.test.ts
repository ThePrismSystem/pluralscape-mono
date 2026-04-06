import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, MOCK_AUTH, postJSON, putJSON } from "../../helpers/route-test-setup.js";

import type { ChannelResult } from "../../../services/channel.service.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/channel.service.js", () => ({
  createChannel: vi.fn(),
  getChannel: vi.fn(),
  listChannels: vi.fn(),
  updateChannel: vi.fn(),
  deleteChannel: vi.fn(),
  archiveChannel: vi.fn(),
  restoreChannel: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../middleware/scope.js", () => mockScopeFactory());

// ── Imports after mocks ──────────────────────────────────────────

const {
  createChannel,
  getChannel,
  listChannels,
  updateChannel,
  deleteChannel,
  archiveChannel,
  restoreChannel,
} = await import("../../../services/channel.service.js");
const { ApiHttpError } = await import("../../../lib/api-error.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/channels";
const CH_ID = "ch_550e8400-e29b-41d4-a716-446655440000";

const MOCK_RESULT: ChannelResult = {
  id: CH_ID as never,
  systemId: MOCK_AUTH.systemId as never,
  type: "channel",
  parentId: null,
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
  vi.mocked(createChannel).mockReset();
  vi.mocked(getChannel).mockReset();
  vi.mocked(listChannels).mockReset();
  vi.mocked(updateChannel).mockReset();
  vi.mocked(deleteChannel).mockReset();
  vi.mocked(archiveChannel).mockReset();
  vi.mocked(restoreChannel).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /systems/:id/channels (create)", () => {
  it("returns 201 with new channel on success", async () => {
    vi.mocked(createChannel).mockResolvedValueOnce(MOCK_RESULT);

    const res = await postJSON(createApp(), BASE, {
      type: "channel",
      encryptedData: "dGVzdA==",
      sortOrder: 0,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(CH_ID);
  });

  it("forwards systemId, body, auth, and audit writer to service", async () => {
    vi.mocked(createChannel).mockResolvedValueOnce(MOCK_RESULT);

    await postJSON(createApp(), BASE, {
      type: "channel",
      encryptedData: "dGVzdA==",
      sortOrder: 0,
    });

    expect(vi.mocked(createChannel)).toHaveBeenCalledWith(
      expect.anything(),
      "sys_550e8400-e29b-41d4-a716-446655440000",
      expect.objectContaining({ type: "channel", encryptedData: "dGVzdA==" }),
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(createChannel).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await postJSON(createApp(), BASE, {
      type: "channel",
      encryptedData: "dGVzdA==",
      sortOrder: 0,
    });

    expect(res.status).toBe(500);
  });
});

describe("GET /systems/:id/channels (list)", () => {
  it("returns 200 with paginated result", async () => {
    vi.mocked(listChannels).mockResolvedValueOnce({
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

describe("GET /systems/:id/channels/:channelId", () => {
  it("returns 200 with channel", async () => {
    vi.mocked(getChannel).mockResolvedValueOnce(MOCK_RESULT);

    const res = await createApp().request(`${BASE}/${CH_ID}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(CH_ID);
  });

  it("returns 404 when channel not found", async () => {
    vi.mocked(getChannel).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
    );

    const res = await createApp().request(`${BASE}/${CH_ID}`);

    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(getChannel).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await createApp().request(`${BASE}/${CH_ID}`);

    expect(res.status).toBe(500);
  });
});

describe("PUT /systems/:id/channels/:channelId", () => {
  it("returns 200 with updated channel", async () => {
    vi.mocked(updateChannel).mockResolvedValueOnce({ ...MOCK_RESULT, version: 2 });

    const res = await putJSON(createApp(), `${BASE}/${CH_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(200);
  });

  it("returns 409 on version conflict", async () => {
    vi.mocked(updateChannel).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );

    const res = await putJSON(createApp(), `${BASE}/${CH_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(409);
  });

  it("returns 404 when channel not found", async () => {
    vi.mocked(updateChannel).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
    );

    const res = await putJSON(createApp(), `${BASE}/${CH_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /systems/:id/channels/:channelId", () => {
  it("returns 204 on success", async () => {
    vi.mocked(deleteChannel).mockResolvedValueOnce(undefined);

    const res = await createApp().request(`${BASE}/${CH_ID}`, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when channel not found", async () => {
    vi.mocked(deleteChannel).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
    );

    const res = await createApp().request(`${BASE}/${CH_ID}`, { method: "DELETE" });

    expect(res.status).toBe(404);
  });

  it("returns 409 when channel has dependents", async () => {
    vi.mocked(deleteChannel).mockRejectedValueOnce(
      new ApiHttpError(409, "HAS_DEPENDENTS", "Channel has dependents", {
        dependents: [{ type: "messages", count: 3 }],
      }),
    );

    const res = await createApp().request(`${BASE}/${CH_ID}`, { method: "DELETE" });

    expect(res.status).toBe(409);
  });
});

describe("POST /systems/:id/channels/:channelId/archive", () => {
  it("returns 204 on success", async () => {
    vi.mocked(archiveChannel).mockResolvedValueOnce(undefined);

    const res = await postJSON(createApp(), `${BASE}/${CH_ID}/archive`, {});

    expect(res.status).toBe(204);
  });

  it("returns 409 when already archived", async () => {
    vi.mocked(archiveChannel).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_ARCHIVED", "Channel is already archived"),
    );

    const res = await postJSON(createApp(), `${BASE}/${CH_ID}/archive`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when channel not found", async () => {
    vi.mocked(archiveChannel).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${CH_ID}/archive`, {});

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/channels/:channelId/restore", () => {
  it("returns 200 with restored channel", async () => {
    vi.mocked(restoreChannel).mockResolvedValueOnce({
      ...MOCK_RESULT,
      version: 3,
    });

    const res = await postJSON(createApp(), `${BASE}/${CH_ID}/restore`, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { version: number } };
    expect(body.data.version).toBe(3);
  });

  it("returns 409 when not archived", async () => {
    vi.mocked(restoreChannel).mockRejectedValueOnce(
      new ApiHttpError(409, "NOT_ARCHIVED", "Channel is not archived"),
    );

    const res = await postJSON(createApp(), `${BASE}/${CH_ID}/restore`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when channel not found", async () => {
    vi.mocked(restoreChannel).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Channel not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${CH_ID}/restore`, {});

    expect(res.status).toBe(404);
  });
});
