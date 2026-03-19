import { getDb } from "../lib/db.js";
import { validateSession } from "../lib/session-auth.js";

import { WS_CLOSE_POLICY_VIOLATION, WS_MAX_CONNECTIONS_PER_ACCOUNT } from "./ws.constants.js";

import type { ConnectionManager } from "./connection-manager.js";
import type { SyncConnectionState } from "./connection-state.js";
import type { AuthenticateRequest, AuthenticateResponse, SyncError } from "@pluralscape/sync";
import type { SystemId } from "@pluralscape/types";

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
): Promise<AuthResult> {
  const { correlationId } = message;

  // 1. Validate session token
  const db = await getDb();
  const result = await validateSession(db, message.sessionToken);

  if (!result.ok) {
    const code = result.error === "SESSION_EXPIRED" ? "AUTH_EXPIRED" : "AUTH_FAILED";
    return {
      ok: false,
      error: {
        type: "SyncError",
        correlationId,
        code,
        message: code === "AUTH_EXPIRED" ? "Session has expired" : "Invalid session token",
        docId: null,
      },
      closeCode: WS_CLOSE_POLICY_VIOLATION,
    };
  }

  const { auth } = result;

  // 2. Per-account connection limit
  if (manager.getAccountConnectionCount(auth.accountId) >= WS_MAX_CONNECTIONS_PER_ACCOUNT) {
    return {
      ok: false,
      error: {
        type: "SyncError",
        correlationId,
        code: "RATE_LIMITED",
        message: "Too many concurrent connections for this account",
        docId: null,
      },
      closeCode: WS_CLOSE_POLICY_VIOLATION,
    };
  }

  // 3. System ownership check
  if (!auth.ownedSystemIds.has(message.systemId as SystemId)) {
    return {
      ok: false,
      error: {
        type: "SyncError",
        correlationId,
        code: "PERMISSION_DENIED",
        message: "System not owned by this account",
        docId: null,
      },
      closeCode: WS_CLOSE_POLICY_VIOLATION,
    };
  }

  // 4. Success — promote connection
  const authenticated = manager.authenticate(
    state.connectionId,
    auth,
    message.systemId,
    message.profileType,
  );

  if (!authenticated) {
    return {
      ok: false,
      error: {
        type: "SyncError",
        correlationId,
        code: "AUTH_FAILED",
        message: "Connection no longer exists",
        docId: null,
      },
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
