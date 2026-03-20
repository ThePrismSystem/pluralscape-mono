import { afterEach, describe, expect, it, vi } from "vitest";

import { mockAuthFactory, mockRateLimitFactory } from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../lib/notification-pubsub.js", () => ({
  getNotificationPubSub: vi.fn().mockReturnValue(undefined),
}));

// ── Import after mocks ──────────────────────────────────────────

const { notificationsRoutes } = await import("../../../routes/notifications/stream.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp() {
  return createRouteApp("/notifications", notificationsRoutes);
}

// ── Tests ────────────────────────────────────────────────────────

describe("GET /notifications/stream", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
});
