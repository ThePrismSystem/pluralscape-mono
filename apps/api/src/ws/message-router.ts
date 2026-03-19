/**
 * WebSocket protocol message router.
 *
 * Implements a state machine that dispatches incoming JSON messages
 * to the appropriate handler based on the connection phase and message type.
 */
import { EncryptedRelay } from "@pluralscape/sync";

import { handleAuthenticate } from "./auth-handler.js";
import { broadcastDocumentUpdate } from "./broadcast.js";
import {
  handleDocumentLoad,
  handleFetchChanges,
  handleFetchSnapshot,
  handleManifestRequest,
  handleSubmitChange,
  handleSubmitSnapshot,
  handleSubscribeRequest,
  handleUnsubscribeRequest,
} from "./handlers.js";
import { CLIENT_MESSAGE_SCHEMAS, MUTATION_MESSAGE_TYPES } from "./message-schemas.js";
import { serializeServerMessage } from "./serialization.js";
import {
  WS_CLOSE_POLICY_VIOLATION,
  WS_MUTATION_RATE_LIMIT,
  WS_MUTATION_RATE_WINDOW_MS,
  WS_RATE_LIMIT_STRIKE_MAX,
  WS_READ_RATE_LIMIT,
  WS_READ_RATE_WINDOW_MS,
} from "./ws.constants.js";
import { formatError, makeSyncError } from "./ws.utils.js";

import type { ConnectionManager } from "./connection-manager.js";
import type { AuthenticatedState, SyncConnectionState } from "./connection-state.js";
import type { ClientMessageType } from "./message-schemas.js";
import type { AppLogger } from "../lib/logger.js";
import type { ServerMessage, SubmitChangeRequest, SubmitSnapshotRequest } from "@pluralscape/sync";
import type { ZodType } from "zod";

// ── DI Context ───────────────────────────────────────────────────────

/** Dependencies injected into the router (testable without module singletons). */
export interface RouterContext {
  readonly relay: EncryptedRelay;
  /**
   * TOFU (Trust On First Use) document ownership.
   *
   * Safe because: the relay is ephemeral (in-memory, lost on restart), all data
   * is E2E encrypted (server is zero-knowledge), and ownership only binds on
   * first write. The real protection is that eviction cleanup
   * (removeSubscriptionsForDoc) prevents cross-system broadcast leaks.
   */
  readonly documentOwnership: Map<string, string>;
  readonly manager: ConnectionManager;
}

/** Create a RouterContext with linked relay eviction → ownership + subscription cleanup. */
export function createRouterContext(
  maxDocuments: number,
  manager: ConnectionManager,
): RouterContext {
  const documentOwnership = new Map<string, string>();
  const relay = new EncryptedRelay({
    maxDocuments,
    onEvict: (docId) => {
      documentOwnership.delete(docId);
      manager.removeSubscriptionsForDoc(docId);
    },
  });
  return { relay, documentOwnership, manager };
}

// ── Type guard ───────────────────────────────────────────────────────

function isClientMessageType(type: string): type is ClientMessageType {
  return Object.hasOwn(CLIENT_MESSAGE_SCHEMAS, type);
}

// ── Send helpers ────────────────────────────────────────────────────

/** Send a ServerMessage to a connection. Returns false if send failed. */
function send(state: SyncConnectionState, msg: ServerMessage, log: AppLogger): boolean {
  try {
    state.ws.send(serializeServerMessage(msg));
    return true;
  } catch (err) {
    log.warn("WebSocket send failed", {
      connectionId: state.connectionId,
      messageType: msg.type,
      error: formatError(err),
    });
    return false;
  }
}

/** Send a SyncError and close the connection. */
function sendErrorAndClose(
  state: SyncConnectionState,
  error: ServerMessage & { type: "SyncError" },
  closeCode: number,
  log: AppLogger,
): void {
  send(state, error, log);
  try {
    state.ws.close(closeCode, error.message);
  } catch {
    log.debug("WebSocket already closed during sendErrorAndClose", {
      connectionId: state.connectionId,
    });
  }
}

/** Send a validation error for a specific message type. */
function sendValidationError(
  state: SyncConnectionState,
  messageType: string,
  zodError: { issues: Array<{ message?: string }> },
  log: AppLogger,
): void {
  // Log full Zod detail server-side, send sanitized message to client
  log.debug("Message validation failed", { messageType, issues: zodError.issues });
  send(state, makeSyncError("MALFORMED_MESSAGE", `Invalid ${messageType}`, null), log);
}

// ── Dispatch helpers ─────────────────────────────────────────────────

/** Parse a message with a Zod schema. Returns null and sends error on failure. */
function parseMessage<T>(
  schema: ZodType<T>,
  parsed: unknown,
  state: SyncConnectionState,
  messageType: string,
  log: AppLogger,
): T | null {
  const result = schema.safeParse(parsed);
  if (!result.success) {
    sendValidationError(state, messageType, result.error, log);
    return null;
  }
  return result.data;
}

/** Check document access (inline — single caller). Returns false and sends PERMISSION_DENIED on failure. */
function checkAccess(
  docId: string,
  systemId: string,
  correlationId: string | null,
  state: SyncConnectionState,
  log: AppLogger,
  ownership: Map<string, string>,
): boolean {
  const owner = ownership.get(docId);
  if (owner !== undefined && owner !== systemId) {
    send(state, makeSyncError("PERMISSION_DENIED", "Access denied", correlationId, docId), log);
    return false;
  }
  return true;
}

/**
 * Parse → access check → dispatch helper for single-doc read operations.
 * Reduces duplication in FetchSnapshot and FetchChanges cases.
 */
function dispatchWithAccess<T extends { docId: string; correlationId: string | null }>(
  schema: ZodType<T>,
  parsed: unknown,
  state: AuthenticatedState,
  messageType: string,
  log: AppLogger,
  ownership: Map<string, string>,
  handler: (msg: T) => ServerMessage,
): void {
  const msg = parseMessage(schema, parsed, state, messageType, log);
  if (!msg) return;
  if (!checkAccess(msg.docId, state.systemId, msg.correlationId, state, log, ownership)) return;
  send(state, handler(msg), log);
}

// ── Router ──────────────────────────────────────────────────────────

/**
 * Route an incoming WebSocket message through the protocol state machine.
 *
 * Phases:
 * - `awaiting-auth`: only AuthenticateRequest accepted
 * - `authenticated`: all 8 remaining message types accepted
 */
export async function routeMessage(
  raw: string,
  state: SyncConnectionState,
  manager: ConnectionManager,
  log: AppLogger,
  ctx: RouterContext,
): Promise<void> {
  // 1. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    sendErrorAndClose(
      state,
      makeSyncError("MALFORMED_MESSAGE", "Invalid JSON", null),
      WS_CLOSE_POLICY_VIOLATION,
      log,
    );
    return;
  }

  // 2. Extract type
  if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
    sendErrorAndClose(
      state,
      makeSyncError("MALFORMED_MESSAGE", "Missing message type", null),
      WS_CLOSE_POLICY_VIOLATION,
      log,
    );
    return;
  }

  const messageType = (parsed as { type: unknown }).type;
  if (typeof messageType !== "string") {
    sendErrorAndClose(
      state,
      makeSyncError("MALFORMED_MESSAGE", "Message type must be a string", null),
      WS_CLOSE_POLICY_VIOLATION,
      log,
    );
    return;
  }

  // 3. Phase: awaiting-auth — only AuthenticateRequest allowed
  if (state.phase === "awaiting-auth") {
    if (messageType !== "AuthenticateRequest") {
      sendErrorAndClose(
        state,
        makeSyncError("AUTH_FAILED", "Must authenticate first", null),
        WS_CLOSE_POLICY_VIOLATION,
        log,
      );
      return;
    }

    // Validate schema
    const schema = CLIENT_MESSAGE_SCHEMAS.AuthenticateRequest;
    const result = schema.safeParse(parsed);
    if (!result.success) {
      log.debug("AuthenticateRequest validation failed", { issues: result.error.issues });
      sendErrorAndClose(
        state,
        makeSyncError("MALFORMED_MESSAGE", "Invalid AuthenticateRequest", null),
        WS_CLOSE_POLICY_VIOLATION,
        log,
      );
      return;
    }

    const authResult = await handleAuthenticate(result.data, state, manager, log);
    if (authResult.ok) {
      send(state, authResult.response, log);
      log.info("WebSocket authenticated", {
        connectionId: state.connectionId,
        syncSessionId: authResult.response.syncSessionId,
      });
    } else {
      sendErrorAndClose(state, authResult.error, authResult.closeCode, log);
    }
    return;
  }

  // At this point, TS narrows state to AuthenticatedState (awaiting-auth returns above).
  // state.systemId and state.auth are guaranteed non-null.

  // 4. Phase: authenticated — validate type is known
  if (!isClientMessageType(messageType)) {
    // Don't echo user input in error message (S13)
    send(state, makeSyncError("MALFORMED_MESSAGE", "Unknown message type", null), log);
    return;
  }

  // AuthenticateRequest is not valid after authentication
  if (messageType === "AuthenticateRequest") {
    send(state, makeSyncError("MALFORMED_MESSAGE", "Already authenticated", null), log);
    return;
  }

  // 5. Rate limit check
  const isMutation = MUTATION_MESSAGE_TYPES.has(messageType);
  const now = Date.now();
  const windowMs = isMutation ? WS_MUTATION_RATE_WINDOW_MS : WS_READ_RATE_WINDOW_MS;
  const limit = isMutation ? WS_MUTATION_RATE_LIMIT : WS_READ_RATE_LIMIT;
  const counter = isMutation ? state.mutationWindow : state.readWindow;

  if (!counter.check(now, windowMs, limit)) {
    state.rateLimitStrikes++;
    send(state, makeSyncError("RATE_LIMITED", "Too many messages", null), log);
    if (state.rateLimitStrikes >= WS_RATE_LIMIT_STRIKE_MAX) {
      log.warn("Closing connection after repeated rate limit violations", {
        connectionId: state.connectionId,
        strikes: state.rateLimitStrikes,
      });
      try {
        state.ws.close(WS_CLOSE_POLICY_VIOLATION, "Rate limit exceeded");
      } catch {
        log.debug("WebSocket already closed during rate limit enforcement", {
          connectionId: state.connectionId,
        });
      }
    }
    return;
  }
  // Decay strikes by 1 on successful message instead of resetting to 0
  if (state.rateLimitStrikes > 0) {
    state.rateLimitStrikes--;
  }

  // 6. Validate and dispatch using helpers
  const { relay, documentOwnership } = ctx;
  switch (messageType) {
    case "ManifestRequest": {
      const msg = parseMessage(
        CLIENT_MESSAGE_SCHEMAS.ManifestRequest,
        parsed,
        state,
        messageType,
        log,
      );
      if (!msg) return;
      // C3: Verify systemId matches the authenticated connection
      if (msg.systemId !== state.systemId) {
        send(
          state,
          makeSyncError("PERMISSION_DENIED", "System ID mismatch", msg.correlationId),
          log,
        );
        return;
      }
      send(state, handleManifestRequest(msg), log);
      break;
    }
    case "SubscribeRequest": {
      const msg = parseMessage(
        CLIENT_MESSAGE_SCHEMAS.SubscribeRequest,
        parsed,
        state,
        messageType,
        log,
      );
      if (!msg) return;
      // I17: Check each doc individually; subscribe permitted ones, deny denied ones
      const permitted: typeof msg.documents = [];
      for (const entry of msg.documents) {
        if (
          checkAccess(entry.docId, state.systemId, msg.correlationId, state, log, documentOwnership)
        ) {
          permitted.push(entry);
        }
        // Denied docs get a PERMISSION_DENIED sent by checkAccess; continue with rest
      }
      if (permitted.length > 0) {
        send(
          state,
          handleSubscribeRequest({ ...msg, documents: permitted }, state, manager, relay),
          log,
        );
      }
      break;
    }
    case "UnsubscribeRequest": {
      const msg = parseMessage(
        CLIENT_MESSAGE_SCHEMAS.UnsubscribeRequest,
        parsed,
        state,
        messageType,
        log,
      );
      if (!msg) return;
      handleUnsubscribeRequest(msg, state, manager);
      break;
    }
    case "FetchSnapshotRequest": {
      dispatchWithAccess(
        CLIENT_MESSAGE_SCHEMAS.FetchSnapshotRequest,
        parsed,
        state,
        messageType,
        log,
        documentOwnership,
        (msg) => handleFetchSnapshot(msg, relay),
      );
      break;
    }
    case "FetchChangesRequest": {
      dispatchWithAccess(
        CLIENT_MESSAGE_SCHEMAS.FetchChangesRequest,
        parsed,
        state,
        messageType,
        log,
        documentOwnership,
        (msg) => handleFetchChanges(msg, relay),
      );
      break;
    }
    case "SubmitChangeRequest": {
      const msg = parseMessage(
        CLIENT_MESSAGE_SCHEMAS.SubmitChangeRequest,
        parsed,
        state,
        messageType,
        log,
      ) as SubmitChangeRequest | null;
      if (!msg) return;
      if (!checkAccess(msg.docId, state.systemId, msg.correlationId, state, log, documentOwnership))
        return;
      // I15: Wrap handler in try/catch to send SyncError on unexpected failure
      let response;
      let sequencedEnvelope;
      try {
        const result = handleSubmitChange(msg, relay);
        response = result.response;
        sequencedEnvelope = result.sequencedEnvelope;
      } catch (err) {
        log.error("handleSubmitChange threw", {
          connectionId: state.connectionId,
          docId: msg.docId,
          error: formatError(err),
        });
        send(
          state,
          makeSyncError("INTERNAL_ERROR", "Failed to process change", msg.correlationId, msg.docId),
          log,
        );
        return;
      }
      // I7: Check send succeeded before broadcasting
      if (!send(state, response, log)) return;
      documentOwnership.set(msg.docId, state.systemId);
      broadcastDocumentUpdate(
        {
          type: "DocumentUpdate",
          correlationId: null,
          docId: msg.docId,
          changes: [sequencedEnvelope],
        },
        state.connectionId,
        manager,
        log,
      );
      break;
    }
    case "SubmitSnapshotRequest": {
      const msg = parseMessage(
        CLIENT_MESSAGE_SCHEMAS.SubmitSnapshotRequest,
        parsed,
        state,
        messageType,
        log,
      ) as SubmitSnapshotRequest | null;
      if (!msg) return;
      if (!checkAccess(msg.docId, state.systemId, msg.correlationId, state, log, documentOwnership))
        return;
      send(state, handleSubmitSnapshot(msg, relay), log);
      documentOwnership.set(msg.docId, state.systemId);
      break;
    }
    case "DocumentLoadRequest": {
      const msg = parseMessage(
        CLIENT_MESSAGE_SCHEMAS.DocumentLoadRequest,
        parsed,
        state,
        messageType,
        log,
      );
      if (!msg) return;
      if (!checkAccess(msg.docId, state.systemId, msg.correlationId, state, log, documentOwnership))
        return;
      const [snapshotResp, changesResp] = handleDocumentLoad(msg, relay);
      // I10: Check first send succeeded before sending second
      if (!send(state, snapshotResp, log)) return;
      send(state, changesResp, log);
      break;
    }
    default: {
      // Compile-time enforcement: all ClientMessageType values handled
      const _exhaustive: never = messageType;
      void _exhaustive;
    }
  }
}
