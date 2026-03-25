/**
 * WebSocket upgrade entry point integration tests.
 *
 * Tests the lifecycle callbacks (onOpen, onMessage, onClose) defined in
 * ws/index.ts by capturing the handler factory from the upgradeWebSocket mock.
 *
 * The factory is invoked per-connection and returns the handler object.
 * We call it directly with a mock Hono context to get the handlers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Types for captured handler ──────────────────────────────────────

/**
 * Simplified handler interface for the WebSocket lifecycle callbacks.
 * Uses Record to avoid coupling with the WSContext type from hono/ws.
 */
interface MockWs {
  close: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

interface WsHandler {
  onOpen?: (evt: unknown, ws: MockWs) => void;
  onMessage?: (evt: { data: unknown }) => void;
  onClose?: () => void;
  onError?: (evt: unknown) => void;
}

// ── Mocks ───────────────────────────────────────────────────────────

/** The factory function passed to upgradeWebSocket in ws/index.ts. */
let capturedFactory: ((c: unknown) => WsHandler) | null = null;

vi.mock("../../ws/bun-adapter.js", () => ({
  upgradeWebSocket: vi.fn((factory: (c: unknown) => WsHandler) => {
    capturedFactory = factory;
    return vi.fn((_c: unknown, next: () => Promise<void>) => next());
  }),
  websocket: { open: vi.fn(), close: vi.fn(), message: vi.fn() },
}));

vi.mock("hono/bun", () => ({
  getConnInfo: vi.fn(() => ({ remote: { address: "127.0.0.1" } })),
}));

vi.mock("../../middleware/access-log.js", () => ({
  accessLogMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

vi.mock("../../middleware/request-id.js", () => ({
  requestIdMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock("../../lib/logger.js", () => ({
  getContextLogger: vi.fn().mockReturnValue(mockLogger),
}));

vi.mock("../../lib/session-auth.js", () => ({
  validateSession: vi.fn().mockResolvedValue({ ok: false, error: "INVALID_TOKEN" }),
}));

vi.mock("../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

let mockOriginAllowed = true;
vi.mock("../../ws/origin-validation.js", () => ({
  isAllowedOrigin: vi.fn(() => mockOriginAllowed),
}));

// ── Import after mocks ──────────────────────────────────────────────

const { connectionManager } = await import("../../ws/index.js");
const {
  WS_MAX_UNAUTHED_CONNECTIONS,
  WS_AUTH_TIMEOUT_MS,
  WS_CLOSE_POLICY_VIOLATION,
  WS_UPGRADE_SAFETY_TIMEOUT_MS,
} = await import("../../ws/ws.constants.js");

// ── Helpers ─────────────────────────────────────────────────────────

function mockWs(): MockWs {
  return {
    close: vi.fn(),
    send: vi.fn(),
  };
}

function mockHonoContext(origin = "http://localhost:3000"): Record<string, unknown> {
  return {
    req: {
      header: vi.fn((name: string) => {
        if (name === "origin") return origin;
        return undefined;
      }),
    },
  };
}

/**
 * Invoke the captured factory to get a connection handler.
 * This mirrors what happens per-WebSocket-upgrade in production.
 */
function createConnectionHandler(origin?: string): WsHandler {
  if (!capturedFactory) {
    throw new Error("upgradeWebSocket factory not captured");
  }
  return capturedFactory(mockHonoContext(origin));
}

// ── Tests ───────────────────────────────────────────────────────────

describe("WS entry point lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    connectionManager.closeAll(1001, "test cleanup");
    mockOriginAllowed = true;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("onOpen / onClose lifecycle", () => {
    it("registers connection on onOpen and removes on onClose", () => {
      const handler = createConnectionHandler();
      const ws = mockWs();

      expect(connectionManager.activeCount).toBe(0);

      handler.onOpen?.(new Event("open"), ws);
      expect(connectionManager.activeCount).toBe(1);

      handler.onClose?.();
      expect(connectionManager.activeCount).toBe(0);
    });

    it("onClose without onOpen releases the reserved unauth slot", () => {
      const handler = createConnectionHandler();
      // Factory already reserved a slot
      const countAfterReserve = connectionManager.unauthenticatedCount;
      expect(countAfterReserve).toBeGreaterThan(0);

      handler.onClose?.();
      // Slot should be released
      expect(connectionManager.unauthenticatedCount).toBe(countAfterReserve - 1);
    });

    it("onError does not remove connection (onClose handles cleanup)", () => {
      const handler = createConnectionHandler();
      const ws = mockWs();

      handler.onOpen?.(new Event("open"), ws);
      expect(connectionManager.activeCount).toBe(1);

      handler.onError?.(new Event("error"));
      // Connection still active — onClose fires after onError per WebSocket spec
      expect(connectionManager.activeCount).toBe(1);

      handler.onClose?.();
      expect(connectionManager.activeCount).toBe(0);
    });
  });

  describe("auth timeout", () => {
    it("closes connection when auth timeout expires", () => {
      const handler = createConnectionHandler();
      const ws = mockWs();

      handler.onOpen?.(new Event("open"), ws);
      expect(connectionManager.activeCount).toBe(1);

      // Advance past the auth timeout
      vi.advanceTimersByTime(WS_AUTH_TIMEOUT_MS + 1);

      // Connection should have been removed by the timeout callback
      expect(connectionManager.activeCount).toBe(0);
      expect(ws.close).toHaveBeenCalled();
    });

    it("does not close connection if auth timeout has not elapsed", () => {
      const handler = createConnectionHandler();
      const ws = mockWs();

      handler.onOpen?.(new Event("open"), ws);

      // Advance less than the auth timeout
      vi.advanceTimersByTime(WS_AUTH_TIMEOUT_MS - 1);

      expect(connectionManager.activeCount).toBe(1);
      expect(ws.close).not.toHaveBeenCalled();
    });
  });

  describe("unauthenticated connection cap", () => {
    it("rejects connection when cap is reached", () => {
      // Fill up the unauthenticated slots via the connection manager directly
      for (let i = 0; i < WS_MAX_UNAUTHED_CONNECTIONS; i++) {
        connectionManager.reserveUnauthSlot();
        connectionManager.register(`cap-${String(i)}`, mockWs() as never, Date.now());
      }

      // The factory checks canAcceptUnauthenticated before reserving
      const handler = createConnectionHandler();
      const ws = mockWs();

      // Handler was created with a rejection path — onOpen closes immediately
      handler.onOpen?.(new Event("open"), ws);
      expect(ws.close).toHaveBeenCalled();
    });
  });

  describe("binary message rejection", () => {
    it("sends SyncError for non-string (binary) messages", () => {
      const handler = createConnectionHandler();
      const ws = mockWs();

      handler.onOpen?.(new Event("open"), ws);

      // Simulate a binary WebSocket frame (ArrayBuffer data)
      const binaryEvt = { data: new ArrayBuffer(16) } as MessageEvent;
      handler.onMessage?.(binaryEvt);

      // The connection's ws.send should have been called with a MALFORMED_MESSAGE error
      expect(ws.send).toHaveBeenCalledTimes(1);
      const sentData = vi.mocked(ws.send).mock.calls[0]?.[0];
      expect(typeof sentData).toBe("string");
      const parsed = JSON.parse(sentData as string) as Record<string, unknown>;
      expect(parsed["type"]).toBe("SyncError");
      expect(parsed["code"]).toBe("MALFORMED_MESSAGE");
      expect(parsed["message"]).toBe("Binary frames are not supported");
    });

    it("does not route binary messages to the message router", () => {
      const handler = createConnectionHandler();
      const ws = mockWs();

      handler.onOpen?.(new Event("open"), ws);

      const binaryEvt = { data: new Uint8Array([1, 2, 3]).buffer } as MessageEvent;
      handler.onMessage?.(binaryEvt);

      // Only the error response should have been sent, no routing
      expect(ws.send).toHaveBeenCalledTimes(1);
    });
  });

  describe("origin validation", () => {
    it("closes connection with policy violation when origin is disallowed", () => {
      mockOriginAllowed = false;
      const handler = createConnectionHandler();
      const ws = mockWs();

      handler.onOpen?.(new Event("open"), ws);
      expect(ws.close).toHaveBeenCalledWith(WS_CLOSE_POLICY_VIOLATION, "Origin not allowed");
    });
  });

  describe("upgrade safety timeout", () => {
    it("releases unauth slot when onOpen never fires", () => {
      const countBefore = connectionManager.unauthenticatedCount;
      const handler = createConnectionHandler();
      expect(connectionManager.unauthenticatedCount).toBe(countBefore + 1);

      // Advance past upgrade safety timeout without calling onOpen
      vi.advanceTimersByTime(WS_UPGRADE_SAFETY_TIMEOUT_MS + 1);

      expect(connectionManager.unauthenticatedCount).toBe(countBefore);
      void handler;
    });
  });
});
