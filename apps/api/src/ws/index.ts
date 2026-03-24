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

import { env } from "../env.js";
import { getContextLogger } from "../lib/logger.js";
import { accessLogMiddleware } from "../middleware/access-log.js";
import { requestIdMiddleware } from "../middleware/request-id.js";

import { upgradeWebSocket, websocket } from "./bun-adapter.js";
import { ConnectionManager } from "./connection-manager.js";
import { createRouterContext, routeMessage } from "./message-router.js";
import { isAllowedOrigin } from "./origin-validation.js";
import { serializeServerMessage } from "./serialization.js";
import {
  WS_AUTH_TIMEOUT_MS,
  WS_CLOSE_POLICY_VIOLATION,
  WS_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
  WS_MAX_MESSAGE_BYTES,
  WS_MAX_UNAUTHED_CONNECTIONS,
  WS_MAX_UNAUTHED_CONNECTIONS_PER_IP,
  WS_RELAY_MAX_DOCUMENTS,
  WS_SUBPROTOCOL,
  WS_UPGRADE_SAFETY_TIMEOUT_MS,
} from "./ws.constants.js";
import { formatError, makeSyncError } from "./ws.utils.js";

import type { AppLogger } from "../lib/logger.js";

// ── Singleton connection manager ────────────────────────────────────

export const connectionManager = new ConnectionManager();
const routerCtx = createRouterContext(WS_RELAY_MAX_DOCUMENTS, connectionManager);

// ── Public API for shutdown ─────────────────────────────────────────

/** Close all active WebSocket connections (used during server shutdown). */
export function closeAllConnections(
  code: number,
  reason: string,
  log?: Pick<AppLogger, "debug">,
): void {
  connectionManager.closeAll(code, reason, log);
}

/** Gracefully shut down all WebSocket connections with a phased close sequence. */
export async function gracefulShutdownConnections(
  log?: Pick<AppLogger, "debug">,
  timeoutMs = WS_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
): Promise<void> {
  await connectionManager.gracefulShutdown(timeoutMs, log);
}

/** Number of active WebSocket connections. */
export function getActiveConnectionCount(): number {
  return connectionManager.activeCount;
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

    // Extract client IP using TRUST_PROXY pattern (same as HTTP rate limiter).
    // When TRUST_PROXY=0, clientIp is undefined and per-IP limiting is disabled.
    const clientIp = env.TRUST_PROXY
      ? (c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined)
      : undefined;

    // Pre-upgrade: reject if unauthenticated connection cap reached (global or per-IP)
    if (
      !connectionManager.canAcceptUnauthenticated(WS_MAX_UNAUTHED_CONNECTIONS) ||
      (clientIp && !connectionManager.canAcceptFromIp(clientIp, WS_MAX_UNAUTHED_CONNECTIONS_PER_IP))
    ) {
      log.warn("WebSocket upgrade rejected: unauthenticated connection limit reached", {
        clientIp: clientIp ?? "unknown",
      });
      return {
        onOpen(_, ws) {
          ws.close(WS_CLOSE_POLICY_VIOLATION, "Too many pending connections");
        },
      };
    }

    // Reserve slot synchronously before upgrade completes (Slowloris prevention)
    connectionManager.reserveUnauthSlot(clientIp);

    const connectionId = uuidv7();
    let opened = false;

    // I6: Safety timeout — release unauth slot if onOpen never fires
    const upgradeTimeout = setTimeout(() => {
      if (!opened) {
        log.warn("WebSocket upgrade timeout — onOpen never fired", { connectionId });
        connectionManager.releaseUnauthSlot(clientIp);
      }
    }, WS_UPGRADE_SAFETY_TIMEOUT_MS);

    log.info("WebSocket upgrade accepted", { connectionId });

    return {
      onOpen(_, ws) {
        opened = true;
        clearTimeout(upgradeTimeout);
        const state = connectionManager.register(connectionId, ws, Date.now(), clientIp);

        // Auth timeout — connection must authenticate within WS_AUTH_TIMEOUT_MS
        state.authTimeoutHandle = setTimeout(() => {
          if (connectionManager.get(connectionId)) {
            log.warn("WebSocket auth timeout", { connectionId });
            try {
              ws.close(WS_CLOSE_POLICY_VIOLATION, "Authentication timeout");
            } catch (err) {
              log.debug("Failed to close on auth timeout", {
                connectionId,
                error: formatError(err),
              });
            }
            // Ensure cleanup even if ws.close() throws and onClose never fires
            connectionManager.remove(connectionId);
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
          try {
            state.ws.send(
              serializeServerMessage(
                makeSyncError("MALFORMED_MESSAGE", "Binary frames are not supported", null),
              ),
            );
          } catch {
            log.debug("Failed to send WebSocket error", { connectionId });
          }
          try {
            state.ws.close(WS_CLOSE_POLICY_VIOLATION, "Binary frames are not supported");
          } catch {
            log.debug("Failed to close WebSocket", { connectionId });
          }
          return;
        }

        // Reject oversized messages before JSON.parse to avoid DoS via
        // large payloads. Bun enforces maxPayloadLength at the transport
        // level, but this check protects the application layer regardless.
        // Note: String.length counts UTF-16 code units, not bytes.
        if (evt.data.length > WS_MAX_MESSAGE_BYTES) {
          log.warn("WebSocket message exceeds size limit", {
            connectionId,
            size: evt.data.length,
          });
          try {
            state.ws.send(
              serializeServerMessage(makeSyncError("MALFORMED_MESSAGE", "Message too large", null)),
            );
          } catch {
            log.debug("Failed to send WebSocket error", { connectionId });
          }
          try {
            state.ws.close(WS_CLOSE_POLICY_VIOLATION, "Message too large");
          } catch {
            log.debug("Failed to close WebSocket", { connectionId });
          }
          return;
        }

        void routeMessage(evt.data, state, log, routerCtx).catch((err: unknown) => {
          log.error("Unhandled error in routeMessage", {
            connectionId,
            error: formatError(err),
          });
        });
      },

      onClose() {
        clearTimeout(upgradeTimeout);
        if (!opened) {
          // onOpen never fired — release reserved slot
          connectionManager.releaseUnauthSlot(clientIp);
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
