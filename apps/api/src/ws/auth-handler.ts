import { getDb } from "../lib/db.js";
import { validateSession } from "../lib/session-auth.js";

import { WS_CLOSE_POLICY_VIOLATION, WS_MAX_CONNECTIONS_PER_ACCOUNT } from "./ws.constants.js";
import { brandedSetHas, formatError, makeSyncError } from "./ws.utils.js";

import type { ConnectionManager } from "./connection-manager.js";
import type { SyncConnectionState } from "./connection-state.js";
import type { AppLogger } from "../lib/logger.js";
import type { AuthenticateRequest, AuthenticateResponse, SyncError } from "@pluralscape/sync";

/** Result of handling an AuthenticateRequest. */
export type AuthResult =
  | { ok: true; response: AuthenticateResponse }
  | { ok: false; error: SyncError; closeCode: number };

/**
 * Handle an AuthenticateRequest message.
 *
 * Validates session token, system ownership, and per-account connection
 * limits. On success, promotes the connection to authenticated state via
 * ConnectionManager.
 *
 * Note: protocol version is enforced by the Zod schema in the message
 * router (Task 4) — by the time this handler runs, protocolVersion is
 * guaranteed to match SYNC_PROTOCOL_VERSION.
 */
export async function handleAuthenticate(
  message: AuthenticateRequest,
  state: SyncConnectionState,
  manager: ConnectionManager,
  log: AppLogger,
): Promise<AuthResult> {
  const { correlationId } = message;

  // 1. Validate session token (wrapped to catch infrastructure errors)
  // Security: the session token is sent in the WS message body rather than
  // in headers, because the browser WebSocket API does not support custom
  // headers on the upgrade request. This is mitigated by requiring TLS —
  // WS connections must use wss:// in production, so the token is encrypted
  // in transit.
  let auth;
  try {
    const db = await getDb();
    const result = await validateSession(db, message.sessionToken);

    if (!result.ok) {
      const code = result.error === "SESSION_EXPIRED" ? "AUTH_EXPIRED" : "AUTH_FAILED";
      return {
        ok: false,
        error: makeSyncError(
          code,
          code === "AUTH_EXPIRED" ? "Session has expired" : "Invalid session token",
          correlationId,
        ),
        closeCode: WS_CLOSE_POLICY_VIOLATION,
      };
    }

    auth = result.auth;
  } catch (err) {
    log.error("Auth infrastructure error", {
      connectionId: state.connectionId,
      error: formatError(err),
    });
    return {
      ok: false,
      error: makeSyncError("AUTH_FAILED", "Authentication service unavailable", correlationId),
      closeCode: WS_CLOSE_POLICY_VIOLATION,
    };
  }

  // 2. Per-account connection limit
  if (manager.getAccountConnectionCount(auth.accountId) >= WS_MAX_CONNECTIONS_PER_ACCOUNT) {
    return {
      ok: false,
      error: makeSyncError(
        "RATE_LIMITED",
        "Too many concurrent connections for this account",
        correlationId,
      ),
      closeCode: WS_CLOSE_POLICY_VIOLATION,
    };
  }

  // 3. System ownership check
  if (!brandedSetHas(auth.ownedSystemIds, message.systemId)) {
    return {
      ok: false,
      error: makeSyncError("PERMISSION_DENIED", "System not owned by this account", correlationId),
      closeCode: WS_CLOSE_POLICY_VIOLATION,
    };
  }

  // 4. Success — promote connection (cast safe: ownedSystemIds membership validated above)
  const authenticated = manager.authenticate(
    state.connectionId,
    auth,
    message.systemId,
    message.profileType,
  );

  if (!authenticated) {
    return {
      ok: false,
      error: makeSyncError("AUTH_FAILED", "Connection no longer exists", correlationId),
      closeCode: WS_CLOSE_POLICY_VIOLATION,
    };
  }

  return {
    ok: true,
    response: {
      type: "AuthenticateResponse",
      correlationId,
      syncSessionId: state.connectionId,
      serverTime: Date.now(),
    },
  };
}
