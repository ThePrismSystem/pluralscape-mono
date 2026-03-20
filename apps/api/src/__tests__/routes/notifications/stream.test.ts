import { afterEach, describe, expect, it, vi } from "vitest";

import { mockAuthFactory, mockRateLimitFactory } from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../lib/notification-pubsub.js", () => ({
  getNotificationPubSub: vi.fn().mockReturnValue(undefined),
}));
vi.mock("../../../lib/logger.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/logger.js")>();
  const mock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return {
    ...actual,
    logger: mock,
  };
});

// ── Import after mocks ──────────────────────────────────────────

const { notificationsRoutes, _resetSseStateForTesting } =
  await import("../../../routes/notifications/stream.js");
const { logger } = await import("../../../lib/logger.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp() {
  return createRouteApp("/notifications", notificationsRoutes);
}

// ── Tests ────────────────────────────────────────────────────────

describe("GET /notifications/stream", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    _resetSseStateForTesting();
  });

  it("returns text/event-stream content type", async () => {
    const app = createApp();
    const res = await app.request("/notifications/stream", {
      method: "GET",
      headers: {
        Authorization: "Bearer fake-token",
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("sets Cache-Control no-cache header", async () => {
    const app = createApp();
    const res = await app.request("/notifications/stream");

    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("returns SSE stream that can be read", async () => {
    const app = createApp();
    const res = await app.request("/notifications/stream");

    expect(res.status).toBe(200);
    expect(res.body).toBeTruthy();
  });

  it("logs warning once when no pub/sub configured", async () => {
    const app = createApp();
    await app.request("/notifications/stream");
    expect(vi.mocked(logger)["warn"]).toHaveBeenCalledWith(
      "SSE: no pub/sub configured, stream will only receive heartbeats",
    );
  });
});
