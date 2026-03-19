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
import { ConnectionManager } from "./connection-manager.js";
import { createRouterContext, routeMessage } from "./message-router.js";
import {
  WS_AUTH_TIMEOUT_MS,
  WS_CLOSE_POLICY_VIOLATION,
  WS_MAX_UNAUTHED_CONNECTIONS,
  WS_RELAY_MAX_DOCUMENTS,
  WS_SUBPROTOCOL,
} from "./ws.constants.js";

import type { AppLogger } from "../lib/logger.js";

// ── Singleton connection manager ────────────────────────────────────

export const connectionManager = new ConnectionManager();
const routerCtx = createRouterContext(WS_RELAY_MAX_DOCUMENTS);

// ── Public API for shutdown ─────────────────────────────────────────

/** Close all active WebSocket connections (used during server shutdown). */
export function closeAllConnections(
  code: number,
  reason: string,
  log?: Pick<AppLogger, "debug">,
): void {
  connectionManager.closeAll(code, reason, log);
}

/** Number of active WebSocket connections. */
export function getActiveConnectionCount(): number {
  return connectionManager.activeCount;
}

// ── Allowed origins ─────────────────────────────────────────────────

function isAllowedOrigin(origin: string | undefined): boolean {
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

    // Pre-upgrade: reject if unauthenticated connection cap reached
    if (!connectionManager.canAcceptUnauthenticated(WS_MAX_UNAUTHED_CONNECTIONS)) {
      log.warn("WebSocket upgrade rejected: unauthenticated connection limit reached");
      return {
        onOpen(_, ws) {
          ws.close(WS_CLOSE_POLICY_VIOLATION, "Too many pending connections");
        },
      };
    }

    // Reserve slot synchronously before upgrade completes (Slowloris prevention)
    connectionManager.reserveUnauthSlot();

    const connectionId = uuidv7();
    let opened = false;
    log.info("WebSocket upgrade accepted", { connectionId });

    return {
      onOpen(_, ws) {
        opened = true;
        const state = connectionManager.register(connectionId, ws, Date.now());

        // Auth timeout — connection must authenticate within WS_AUTH_TIMEOUT_MS
        state.authTimeoutHandle = setTimeout(() => {
          if (connectionManager.get(connectionId)) {
            log.warn("WebSocket auth timeout", { connectionId });
            try {
              ws.close(WS_CLOSE_POLICY_VIOLATION, "Authentication timeout");
            } catch {
              // Already closed
            }
          }
        }, WS_AUTH_TIMEOUT_MS);

        log.debug("WebSocket connection opened", {
          connectionId,
          activeConnections: connectionManager.activeCount,
        });
      },

      onMessage(evt) {
        const state = connectionManager.get(connectionId);
        if (!state) return;

        // V1 protocol is text-framed JSON — reject binary frames
        if (typeof evt.data !== "string") {
          log.warn("WebSocket received non-string message", { connectionId });
          return;
        }

        void routeMessage(evt.data, state, connectionManager, log, routerCtx).catch(
          (err: unknown) => {
            log.error("Unhandled error in routeMessage", {
              connectionId,
              error: err instanceof Error ? err.message : String(err),
            });
          },
        );
      },

      onClose() {
        if (!opened) {
          // onOpen never fired — release reserved slot
          connectionManager.releaseUnauthSlot();
        } else {
          connectionManager.remove(connectionId);
        }
        log.debug("WebSocket connection closed", {
          connectionId,
          activeConnections: connectionManager.activeCount,
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
