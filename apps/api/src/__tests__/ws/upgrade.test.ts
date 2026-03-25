import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the Bun-specific WebSocket adapter (not available in Node.js/Vitest)
vi.mock("../../ws/bun-adapter.js", () => ({
  upgradeWebSocket: vi.fn(() => vi.fn()),
  websocket: { open: vi.fn(), close: vi.fn(), message: vi.fn() },
}));

vi.mock("hono/bun", () => ({
  getConnInfo: vi.fn(() => ({ remote: { address: "127.0.0.1" } })),
}));

import { closeAllConnections, getActiveConnectionCount, syncWsApp } from "../../ws/index.js";
import { WS_SUBPROTOCOL } from "../../ws/ws.constants.js";

describe("WebSocket upgrade endpoint", () => {
  afterEach(() => {
    closeAllConnections(1001, "test cleanup");
  });

  it("exposes the sync subprotocol constant", () => {
    expect(WS_SUBPROTOCOL).toBe("pluralscape-sync-v1");
  });

  it("exports the Hono sub-app with a route at /ws", () => {
    expect(syncWsApp).toBeDefined();
    expect(typeof syncWsApp.fetch).toBe("function");
  });

  it("rejects non-GET requests to /ws with 404 or 405", async () => {
    const res = await syncWsApp.request("/ws", { method: "POST" });
    expect([404, 405]).toContain(res.status);
  });

  it("returns 0 active connections initially", () => {
    expect(getActiveConnectionCount()).toBe(0);
  });

  it("closeAllConnections is idempotent on empty state", () => {
    closeAllConnections(1001, "test");
    expect(getActiveConnectionCount()).toBe(0);
  });
});

describe("WebSocket constants", () => {
  it("has correct max message size (5 MB)", async () => {
    const { WS_MAX_MESSAGE_BYTES } = await import("../../ws/ws.constants.js");
    expect(WS_MAX_MESSAGE_BYTES).toBe(5_242_880);
  });

  it("has correct auth timeout (10s)", async () => {
    const { WS_AUTH_TIMEOUT_MS } = await import("../../ws/ws.constants.js");
    expect(WS_AUTH_TIMEOUT_MS).toBe(10_000);
  });

  it("has correct idle timeout (60s)", async () => {
    const { WS_IDLE_TIMEOUT_SECONDS } = await import("../../ws/ws.constants.js");
    expect(WS_IDLE_TIMEOUT_SECONDS).toBe(60);
  });

  it("has connection limits configured", async () => {
    const { WS_MAX_UNAUTHED_CONNECTIONS, WS_MAX_CONNECTIONS_PER_ACCOUNT } =
      await import("../../ws/ws.constants.js");
    expect(WS_MAX_UNAUTHED_CONNECTIONS).toBe(500);
    expect(WS_MAX_CONNECTIONS_PER_ACCOUNT).toBe(10);
  });
});
