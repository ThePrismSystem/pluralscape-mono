/**
 * WebSocket sync server.
 *
 * Mounts at /v1/sync/ws. Handles the sync protocol defined in
 * packages/sync/docs/protocol-messages.md over a WebSocket transport.
 *
 * This module exports both the Hono sub-app (for route registration)
 * and the Bun WebSocket handler (for Bun.serve() wiring).
 */
import { Hono } from "hono";
import { v7 as uuidv7 } from "uuid";

import { getContextLogger } from "../lib/logger.js";
import { accessLogMiddleware } from "../middleware/access-log.js";
import { requestIdMiddleware } from "../middleware/request-id.js";

import { upgradeWebSocket, websocket } from "./bun-adapter.js";
import { WS_AUTH_TIMEOUT_MS, WS_CLOSE_POLICY_VIOLATION, WS_SUBPROTOCOL } from "./ws.constants.js";

import type { WSContext } from "hono/ws";

// ── Connection registry (populated by Task 2: ConnectionManager) ────
// For now, a minimal map to track connections for shutdown cleanup.

interface MinimalConnectionEntry {
  readonly connectionId: string;
  readonly ws: WSContext;
  authTimeoutHandle: ReturnType<typeof setTimeout> | null;
  authenticated: boolean;
}

const connections = new Map<string, MinimalConnectionEntry>();

// ── Public API for shutdown ─────────────────────────────────────────

/** Close all active WebSocket connections (used during server shutdown). */
export function closeAllConnections(code: number, reason: string): void {
  for (const entry of connections.values()) {
    if (entry.authTimeoutHandle !== null) {
      clearTimeout(entry.authTimeoutHandle);
      entry.authTimeoutHandle = null;
    }
    try {
      entry.ws.close(code, reason);
    } catch {
      // Connection may already be dead
    }
  }
  connections.clear();
}

/** Number of active WebSocket connections. */
export function getActiveConnectionCount(): number {
  return connections.size;
}

// ── Allowed origins ─────────────────────────────────────────────────

function isAllowedOrigin(origin: string | undefined): boolean {
  // In development/test, allow all origins
  if (process.env["NODE_ENV"] === "test" || process.env["NODE_ENV"] === "development") {
    return true;
  }

  if (!origin) {
    // Non-browser clients (native apps, CLI tools) don't send Origin
    return true;
  }

  const allowed = process.env["ALLOWED_ORIGINS"]?.split(",") ?? [];
  return allowed.includes(origin);
}

// ── Hono sub-app ────────────────────────────────────────────────────

export const syncWsApp = new Hono();
syncWsApp.use("*", requestIdMiddleware());
syncWsApp.use("*", accessLogMiddleware());

syncWsApp.get(
  "/ws",
  upgradeWebSocket((c) => {
    const log = getContextLogger(c);
    const origin = c.req.header("origin");

    // Pre-upgrade: validate Origin (CSWSH prevention)
    if (!isAllowedOrigin(origin)) {
      log.warn("WebSocket upgrade rejected: disallowed origin", { origin });
      return {
        onOpen(_, ws) {
          ws.close(WS_CLOSE_POLICY_VIOLATION, "Origin not allowed");
        },
      };
    }

    const connectionId = uuidv7();
    log.info("WebSocket upgrade accepted", { connectionId });

    return {
      onOpen(_, ws) {
        // Set auth timeout — connection must authenticate within WS_AUTH_TIMEOUT_MS
        const authTimeout = setTimeout(() => {
          const entry = connections.get(connectionId);
          if (entry) {
            log.warn("WebSocket auth timeout", { connectionId });
            try {
              ws.close(WS_CLOSE_POLICY_VIOLATION, "Authentication timeout");
            } catch {
              // Already closed
            }
          }
        }, WS_AUTH_TIMEOUT_MS);

        connections.set(connectionId, {
          connectionId,
          ws,
          authTimeoutHandle: authTimeout,
          authenticated: false,
        });

        log.debug("WebSocket connection opened", {
          connectionId,
          activeConnections: connections.size,
        });
      },

      onMessage() {
        // Message routing implemented in Task 4 (api-bvtm)
        log.debug("WebSocket message received", { connectionId });
      },

      onClose() {
        const entry = connections.get(connectionId);
        if (entry?.authTimeoutHandle !== null && entry?.authTimeoutHandle !== undefined) {
          clearTimeout(entry.authTimeoutHandle);
        }
        connections.delete(connectionId);

        log.debug("WebSocket connection closed", {
          connectionId,
          activeConnections: connections.size,
        });
      },

      onError(evt) {
        log.error("WebSocket error", {
          connectionId,
          error: evt instanceof Error ? evt.message : "Unknown error",
        });
        // Cleanup happens in onClose which fires after onError
      },
    };
  }),
);

export { websocket };
export { WS_SUBPROTOCOL };
