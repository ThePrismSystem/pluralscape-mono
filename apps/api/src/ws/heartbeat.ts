/**
 * Application-level WebSocket heartbeat (Ping/Pong).
 *
 * Bun's built-in WebSocket sendPings handles transport-level keep-alive,
 * but application-level heartbeat is needed to detect connections where
 * the TCP link is alive but the application layer is unresponsive
 * (e.g., frozen browser tabs, suspended mobile apps).
 *
 * The server sends {"type":"Ping"} at regular intervals and expects
 * {"type":"Pong"} back within a timeout window. Connections that fail
 * to respond are closed.
 */
import {
  WS_CLOSE_POLICY_VIOLATION,
  WS_HEARTBEAT_INTERVAL_MS,
  WS_PONG_TIMEOUT_MS,
} from "./ws.constants.js";
import { formatError } from "./ws.utils.js";

import type { AppLogger } from "../lib/logger.js";
import type { WSContext } from "hono/ws";

/** Serialized ping message (pre-computed to avoid allocation per tick). */
const PING_MESSAGE = JSON.stringify({ type: "Ping" });

/** Per-connection heartbeat state. */
interface HeartbeatState {
  /** Interval handle for sending periodic pings. */
  intervalHandle: ReturnType<typeof setInterval>;
  /** Timeout handle waiting for pong response — null when no ping is outstanding. */
  pongTimeoutHandle: ReturnType<typeof setTimeout> | null;
  /** Reference to the WebSocket for sending pings and closing on timeout. */
  ws: WSContext;
  /** Callback invoked when the connection is determined dead (ping failure or pong timeout). */
  onDead: (() => void) | undefined;
}

/** Active heartbeat state keyed by connectionId. */
const heartbeats = new Map<string, HeartbeatState>();

/**
 * Start heartbeat monitoring for an authenticated connection.
 *
 * Sends a Ping message every WS_HEARTBEAT_INTERVAL_MS. If no Pong is
 * received within WS_PONG_TIMEOUT_MS after a Ping, the connection is closed.
 */
export function startHeartbeat(
  connectionId: string,
  ws: WSContext,
  log: AppLogger,
  onDead?: () => void,
): void {
  // Prevent duplicate heartbeat for same connection
  clearHeartbeat(connectionId);

  const state: HeartbeatState = {
    ws,
    pongTimeoutHandle: null,
    onDead,
    intervalHandle: setInterval(() => {
      sendPing(connectionId, state, log);
    }, WS_HEARTBEAT_INTERVAL_MS),
  };

  heartbeats.set(connectionId, state);
}

/** Send a Ping and start the pong timeout. */
function sendPing(connectionId: string, state: HeartbeatState, log: AppLogger): void {
  try {
    state.ws.send(PING_MESSAGE);
  } catch (err: unknown) {
    log.warn("Heartbeat ping send failed", {
      connectionId,
      error: formatError(err),
    });
    clearHeartbeat(connectionId);
    state.onDead?.();
    return;
  }

  // Start pong timeout — if no Pong arrives, close the connection
  state.pongTimeoutHandle = setTimeout(() => {
    log.warn("WebSocket heartbeat timeout — no Pong received", { connectionId });
    try {
      state.ws.close(WS_CLOSE_POLICY_VIOLATION, "Heartbeat timeout");
    } catch (err: unknown) {
      log.debug("Failed to close on heartbeat timeout", {
        connectionId,
        error: formatError(err),
      });
    }
    // Clean up heartbeat state since connection is being closed
    heartbeats.delete(connectionId);
    state.onDead?.();
  }, WS_PONG_TIMEOUT_MS);
}

/** Handle an incoming Pong message — clears the outstanding pong timeout. */
export function handlePong(connectionId: string): void {
  const state = heartbeats.get(connectionId);
  if (!state) return;

  if (state.pongTimeoutHandle !== null) {
    clearTimeout(state.pongTimeoutHandle);
    state.pongTimeoutHandle = null;
  }
}

/** Clear all heartbeat timers for a connection (called on disconnect/remove). */
export function clearHeartbeat(connectionId: string): void {
  const state = heartbeats.get(connectionId);
  if (!state) return;

  clearInterval(state.intervalHandle);
  if (state.pongTimeoutHandle !== null) {
    clearTimeout(state.pongTimeoutHandle);
  }
  heartbeats.delete(connectionId);
}
