import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_LOGGER_BRAND } from "../../lib/logger.js";
import { clearHeartbeat, handlePong, startHeartbeat } from "../../ws/heartbeat.js";
import { WS_HEARTBEAT_INTERVAL_MS, WS_PONG_TIMEOUT_MS } from "../../ws/ws.constants.js";

import type { AppLogger } from "../../lib/logger.js";

// ── Helpers ────────────────────────────────────────────────────────

function mockWs(): { close: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  return { close: vi.fn(), send: vi.fn() };
}

const warnSpy = vi.fn();

function mockLog(): AppLogger {
  return {
    [APP_LOGGER_BRAND]: true as const,
    info: vi.fn(),
    warn: warnSpy,
    error: vi.fn(),
    debug: vi.fn(),
  };
}

describe("heartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("startHeartbeat", () => {
    it("sends a Ping message at the heartbeat interval", () => {
      const ws = mockWs();
      const log = mockLog();
      const connectionId = "conn-hb-1";

      startHeartbeat(connectionId, ws as never, log);

      // No ping sent immediately
      expect(ws.send).not.toHaveBeenCalled();

      // Advance to first interval
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);

      expect(ws.send).toHaveBeenCalledOnce();
      const parsed = JSON.parse(ws.send.mock.calls[0]?.[0] as string) as { type: string };
      expect(parsed.type).toBe("Ping");

      clearHeartbeat(connectionId);
    });

    it("sends multiple pings at each interval", () => {
      const ws = mockWs();
      const log = mockLog();
      const connectionId = "conn-hb-2";

      startHeartbeat(connectionId, ws as never, log);

      // Simulate pong response after first ping
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);
      expect(ws.send).toHaveBeenCalledTimes(1);
      handlePong(connectionId);

      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);
      expect(ws.send).toHaveBeenCalledTimes(2);
      handlePong(connectionId);

      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);
      expect(ws.send).toHaveBeenCalledTimes(3);

      clearHeartbeat(connectionId);
    });

    it("closes connection when pong is not received within timeout", () => {
      const ws = mockWs();
      const log = mockLog();
      const connectionId = "conn-hb-timeout";

      startHeartbeat(connectionId, ws as never, log);

      // Trigger ping
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);
      expect(ws.send).toHaveBeenCalledOnce();

      // No pong received — advance past pong timeout
      vi.advanceTimersByTime(WS_PONG_TIMEOUT_MS);

      expect(ws.close).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("heartbeat"),
        expect.objectContaining({ connectionId: "conn-hb-timeout" }),
      );
    });

    it("does not close connection when pong is received in time", () => {
      const ws = mockWs();
      const log = mockLog();
      const connectionId = "conn-hb-pong";

      startHeartbeat(connectionId, ws as never, log);

      // Trigger ping
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);
      expect(ws.send).toHaveBeenCalledOnce();

      // Receive pong before timeout
      handlePong(connectionId);

      // Advance past when timeout would have fired
      vi.advanceTimersByTime(WS_PONG_TIMEOUT_MS);

      expect(ws.close).not.toHaveBeenCalled();

      clearHeartbeat(connectionId);
    });
  });

  describe("clearHeartbeat", () => {
    it("stops all timers for a connection", () => {
      const ws = mockWs();
      const log = mockLog();
      const connectionId = "conn-hb-clear";

      startHeartbeat(connectionId, ws as never, log);

      // Trigger ping to start pong timeout
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);

      // Clear before pong timeout fires
      clearHeartbeat(connectionId);

      // Advance past pong timeout — connection should NOT be closed
      vi.advanceTimersByTime(WS_PONG_TIMEOUT_MS);
      expect(ws.close).not.toHaveBeenCalled();

      // Advance another full interval — no more pings
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);
      expect(ws.send).toHaveBeenCalledTimes(1); // Only the first ping
    });

    it("is safe to call for unknown connection", () => {
      expect(() => {
        clearHeartbeat("nonexistent");
      }).not.toThrow();
    });

    it("is safe to call twice for same connection", () => {
      const ws = mockWs();
      const log = mockLog();
      const connectionId = "conn-hb-double-clear";

      startHeartbeat(connectionId, ws as never, log);
      clearHeartbeat(connectionId);
      expect(() => {
        clearHeartbeat(connectionId);
      }).not.toThrow();
    });
  });

  describe("handlePong", () => {
    it("clears the pong timeout", () => {
      const ws = mockWs();
      const log = mockLog();
      const connectionId = "conn-hb-pong-clear";

      startHeartbeat(connectionId, ws as never, log);

      // Trigger ping
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);
      expect(ws.send).toHaveBeenCalledOnce();

      // Receive pong
      handlePong(connectionId);

      // Advance past timeout — should not close
      vi.advanceTimersByTime(WS_PONG_TIMEOUT_MS);
      expect(ws.close).not.toHaveBeenCalled();

      clearHeartbeat(connectionId);
    });

    it("is safe to call for unknown connection", () => {
      expect(() => {
        handlePong("nonexistent");
      }).not.toThrow();
    });

    it("tolerates send failure on ping", () => {
      const ws = mockWs();
      ws.send.mockImplementation(() => {
        throw new Error("broken pipe");
      });
      const log = mockLog();
      const connectionId = "conn-hb-send-fail";

      startHeartbeat(connectionId, ws as never, log);

      // Trigger ping — send will throw
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);

      // Should have logged the error but not crashed
      expect(warnSpy).toHaveBeenCalled();

      clearHeartbeat(connectionId);
    });
  });
});
