import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearHeartbeat, handlePong, startHeartbeat } from "../../ws/heartbeat.js";
import { WS_HEARTBEAT_INTERVAL_MS, WS_PONG_TIMEOUT_MS } from "../../ws/ws.constants.js";
import { createMockLogger, mockWs } from "../helpers/ws-test-helpers.js";

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
      const { logger } = createMockLogger();
      const connectionId = "conn-hb-1";

      startHeartbeat(connectionId, ws as never, logger);

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
      const { logger } = createMockLogger();
      const connectionId = "conn-hb-2";

      startHeartbeat(connectionId, ws as never, logger);

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
      const { logger, methods } = createMockLogger();
      const connectionId = "conn-hb-timeout";

      startHeartbeat(connectionId, ws as never, logger);

      // Trigger ping
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);
      expect(ws.send).toHaveBeenCalledOnce();

      // No pong received — advance past pong timeout
      vi.advanceTimersByTime(WS_PONG_TIMEOUT_MS);

      expect(ws.close).toHaveBeenCalledOnce();
      expect(methods.warn).toHaveBeenCalledWith(
        expect.stringContaining("heartbeat"),
        expect.objectContaining({ connectionId: "conn-hb-timeout" }),
      );
    });

    it("does not close connection when pong is received in time", () => {
      const ws = mockWs();
      const { logger } = createMockLogger();
      const connectionId = "conn-hb-pong";

      startHeartbeat(connectionId, ws as never, logger);

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

  describe("onDead callback", () => {
    it("calls onDead when ping send fails", () => {
      const ws = mockWs();
      ws.send.mockImplementation(() => {
        throw new Error("broken pipe");
      });
      const { logger } = createMockLogger();
      const onDead = vi.fn();

      startHeartbeat("conn-dead-ping", ws as never, logger, onDead);

      // Trigger ping — send will throw
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);

      expect(onDead).toHaveBeenCalledOnce();
    });

    it("stops interval after ping send failure", () => {
      const ws = mockWs();
      ws.send.mockImplementation(() => {
        throw new Error("broken pipe");
      });
      const { logger } = createMockLogger();
      const onDead = vi.fn();

      startHeartbeat("conn-dead-interval", ws as never, logger, onDead);

      // Trigger ping — send will throw, heartbeat should be cleared
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);
      expect(onDead).toHaveBeenCalledOnce();

      // Advance another interval — no more pings should be attempted
      onDead.mockClear();
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);
      // send was called once (the failed attempt), no additional calls
      expect(ws.send).toHaveBeenCalledTimes(1);
      expect(onDead).not.toHaveBeenCalled();
    });

    it("calls onDead on normal pong timeout close", () => {
      const ws = mockWs();
      const { logger } = createMockLogger();
      const onDead = vi.fn();

      startHeartbeat("conn-dead-timeout", ws as never, logger, onDead);

      // Trigger ping
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);

      // No pong — advance past timeout
      vi.advanceTimersByTime(WS_PONG_TIMEOUT_MS);

      expect(ws.close).toHaveBeenCalledOnce();
      expect(onDead).toHaveBeenCalledOnce();
    });

    it("calls onDead when ws.close throws on pong timeout", () => {
      const ws = mockWs();
      ws.close.mockImplementation(() => {
        throw new Error("already closed");
      });
      const { logger } = createMockLogger();
      const onDead = vi.fn();

      startHeartbeat("conn-dead-close-throws", ws as never, logger, onDead);

      // Trigger ping
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);

      // No pong — advance past timeout, ws.close throws
      vi.advanceTimersByTime(WS_PONG_TIMEOUT_MS);

      expect(ws.close).toHaveBeenCalledOnce();
      expect(onDead).toHaveBeenCalledOnce();
    });
  });

  describe("clearHeartbeat", () => {
    it("stops all timers for a connection", () => {
      const ws = mockWs();
      const { logger } = createMockLogger();
      const connectionId = "conn-hb-clear";

      startHeartbeat(connectionId, ws as never, logger);

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
      const { logger } = createMockLogger();
      const connectionId = "conn-hb-double-clear";

      startHeartbeat(connectionId, ws as never, logger);
      clearHeartbeat(connectionId);
      expect(() => {
        clearHeartbeat(connectionId);
      }).not.toThrow();
    });
  });

  describe("handlePong", () => {
    it("clears the pong timeout", () => {
      const ws = mockWs();
      const { logger } = createMockLogger();
      const connectionId = "conn-hb-pong-clear";

      startHeartbeat(connectionId, ws as never, logger);

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
      const { logger, methods } = createMockLogger();
      const connectionId = "conn-hb-send-fail";

      startHeartbeat(connectionId, ws as never, logger);

      // Trigger ping — send will throw
      vi.advanceTimersByTime(WS_HEARTBEAT_INTERVAL_MS);

      // Should have logged the error but not crashed
      expect(methods.warn).toHaveBeenCalled();

      clearHeartbeat(connectionId);
    });
  });
});
