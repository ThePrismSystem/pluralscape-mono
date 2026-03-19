/**
 * WebSocket protocol message router.
 *
 * Implements a state machine that dispatches incoming JSON messages
 * to the appropriate handler based on the connection phase and message type.
 */
import { EncryptedRelay } from "@pluralscape/sync";

import { handleAuthenticate } from "./auth-handler.js";
import { broadcastDocumentUpdate } from "./broadcast.js";
import { handleDocumentLoad } from "./handlers/document-load.js";
import { handleFetchChanges, handleFetchSnapshot } from "./handlers/fetch.js";
import { handleManifestRequest } from "./handlers/manifest.js";
import { handleSubmitChange, handleSubmitSnapshot } from "./handlers/submit.js";
import { handleSubscribeRequest, handleUnsubscribeRequest } from "./handlers/subscribe.js";
import { CLIENT_MESSAGE_SCHEMAS, MUTATION_MESSAGE_TYPES } from "./message-schemas.js";
import { bytesToBase64url } from "./serialization.js";
import {
  WS_CLOSE_POLICY_VIOLATION,
  WS_MUTATION_RATE_LIMIT,
  WS_MUTATION_RATE_WINDOW_MS,
  WS_READ_RATE_LIMIT,
  WS_READ_RATE_WINDOW_MS,
} from "./ws.constants.js";

import type { ConnectionManager } from "./connection-manager.js";
import type { SyncConnectionState } from "./connection-state.js";
import type { ClientMessageType } from "./message-schemas.js";
import type { AppLogger } from "../lib/logger.js";
import type { ServerMessage, SyncError } from "@pluralscape/sync";

// ── Singleton relay (Phase 1: in-memory) ────────────────────────────

const relay = new EncryptedRelay();

// ── Response serialization ──────────────────────────────────────────

/**
 * Serialize a ServerMessage to JSON, converting Uint8Array fields to Base64url.
 */
function serializeResponse(msg: ServerMessage): string {
  return JSON.stringify(msg, (_key, value: unknown) => {
    if (value instanceof Uint8Array) {
      return bytesToBase64url(value);
    }
    return value;
  });
}

/** Send a ServerMessage to a connection. */
function send(state: SyncConnectionState, msg: ServerMessage): void {
  try {
    state.ws.send(serializeResponse(msg));
  } catch {
    // Connection may have closed between check and send
  }
}

/** Send a SyncError and close the connection. */
function sendErrorAndClose(state: SyncConnectionState, error: SyncError, closeCode: number): void {
  send(state, error);
  try {
    state.ws.close(closeCode, error.message);
  } catch {
    // Already closed
  }
}

// ── Rate limiting ───────────────────────────────────────────────────

function checkRateLimit(state: SyncConnectionState, isMutation: boolean): boolean {
  const now = Date.now();

  if (isMutation) {
    if (now - state.mutationWindowStart > WS_MUTATION_RATE_WINDOW_MS) {
      state.mutationCount = 0;
      state.mutationWindowStart = now;
    }
    state.mutationCount++;
    return state.mutationCount <= WS_MUTATION_RATE_LIMIT;
  }

  if (now - state.readWindowStart > WS_READ_RATE_WINDOW_MS) {
    state.readCount = 0;
    state.readWindowStart = now;
  }
  state.readCount++;
  return state.readCount <= WS_READ_RATE_LIMIT;
}

// ── Router ──────────────────────────────────────────────────────────

/**
 * Route an incoming WebSocket message through the protocol state machine.
 *
 * Phases:
 * - `awaiting-auth`: only AuthenticateRequest accepted
 * - `authenticated`: all 8 remaining message types accepted
 * - `closing`: silently discarded
 */
export async function routeMessage(
  raw: string,
  state: SyncConnectionState,
  manager: ConnectionManager,
  log: AppLogger,
): Promise<void> {
  // Phase: closing — discard silently
  if (state.phase === "closing") return;

  // 1. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    sendErrorAndClose(
      state,
      {
        type: "SyncError",
        correlationId: null,
        code: "MALFORMED_MESSAGE",
        message: "Invalid JSON",
        docId: null,
      },
      WS_CLOSE_POLICY_VIOLATION,
    );
    return;
  }

  // 2. Extract type
  if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
    sendErrorAndClose(
      state,
      {
        type: "SyncError",
        correlationId: null,
        code: "MALFORMED_MESSAGE",
        message: "Missing message type",
        docId: null,
      },
      WS_CLOSE_POLICY_VIOLATION,
    );
    return;
  }

  const messageType = (parsed as { type: unknown }).type;
  if (typeof messageType !== "string") {
    sendErrorAndClose(
      state,
      {
        type: "SyncError",
        correlationId: null,
        code: "MALFORMED_MESSAGE",
        message: "Message type must be a string",
        docId: null,
      },
      WS_CLOSE_POLICY_VIOLATION,
    );
    return;
  }

  // 3. Phase: awaiting-auth — only AuthenticateRequest allowed
  if (state.phase === "awaiting-auth") {
    if (messageType !== "AuthenticateRequest") {
      sendErrorAndClose(
        state,
        {
          type: "SyncError",
          correlationId: null,
          code: "AUTH_FAILED",
          message: "Must authenticate first",
          docId: null,
        },
        WS_CLOSE_POLICY_VIOLATION,
      );
      return;
    }

    // Validate schema
    const schema = CLIENT_MESSAGE_SCHEMAS.AuthenticateRequest;
    const result = schema.safeParse(parsed);
    if (!result.success) {
      const detail = result.error.issues[0]?.message ?? "Validation failed";
      sendErrorAndClose(
        state,
        {
          type: "SyncError",
          correlationId: null,
          code: "MALFORMED_MESSAGE",
          message: `Invalid AuthenticateRequest: ${detail}`,
          docId: null,
        },
        WS_CLOSE_POLICY_VIOLATION,
      );
      return;
    }

    const authResult = await handleAuthenticate(result.data as never, state, manager);
    if (authResult.ok) {
      send(state, authResult.response);
      log.info("WebSocket authenticated", {
        connectionId: state.connectionId,
        accountId: state.auth?.accountId,
      });
    } else {
      sendErrorAndClose(state, authResult.error, authResult.closeCode);
    }
    return;
  }

  // 4. Phase: authenticated — validate type is known
  if (!(messageType in CLIENT_MESSAGE_SCHEMAS)) {
    send(state, {
      type: "SyncError",
      correlationId: null,
      code: "MALFORMED_MESSAGE",
      message: `Unknown message type: ${messageType}`,
      docId: null,
    });
    return;
  }

  // AuthenticateRequest is not valid after authentication
  if (messageType === "AuthenticateRequest") {
    send(state, {
      type: "SyncError",
      correlationId: null,
      code: "MALFORMED_MESSAGE",
      message: "Already authenticated",
      docId: null,
    });
    return;
  }

  // 5. Rate limit check
  const isMutation = MUTATION_MESSAGE_TYPES.has(messageType);
  if (!checkRateLimit(state, isMutation)) {
    send(state, {
      type: "SyncError",
      correlationId: null,
      code: "RATE_LIMITED",
      message: "Too many messages",
      docId: null,
    });
    return;
  }

  // 6. Validate schema
  const typedKey = messageType as ClientMessageType;
  const schema = CLIENT_MESSAGE_SCHEMAS[typedKey];
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? "Validation failed";
    send(state, {
      type: "SyncError",
      correlationId: null,
      code: "MALFORMED_MESSAGE",
      message: `Invalid ${messageType}: ${detail}`,
      docId: null,
    });
    return;
  }

  // 7. Dispatch to handler
  const validated = result.data;
  switch (typedKey) {
    case "ManifestRequest": {
      const response = handleManifestRequest(validated as never);
      send(state, response);
      break;
    }
    case "SubscribeRequest": {
      const response = handleSubscribeRequest(validated as never, state, manager, relay);
      send(state, response);
      break;
    }
    case "UnsubscribeRequest": {
      handleUnsubscribeRequest(validated as never, state, manager);
      break;
    }
    case "FetchSnapshotRequest": {
      const response = handleFetchSnapshot(validated as never, relay);
      send(state, response);
      break;
    }
    case "FetchChangesRequest": {
      const response = handleFetchChanges(validated as never, relay);
      send(state, response);
      break;
    }
    case "SubmitChangeRequest": {
      const msg = validated as { docId: string; change: Record<string, unknown> };
      const response = handleSubmitChange(validated as never, relay);
      send(state, response);

      // Broadcast DocumentUpdate to all subscribers except submitter
      broadcastDocumentUpdate(
        {
          type: "DocumentUpdate",
          correlationId: null,
          docId: msg.docId,
          changes: [{ ...msg.change, documentId: msg.docId, seq: response.assignedSeq } as never],
        },
        state.connectionId,
        manager,
        log,
      );
      break;
    }
    case "SubmitSnapshotRequest": {
      const response = handleSubmitSnapshot(validated as never, relay);
      send(state, response);
      break;
    }
    case "DocumentLoadRequest": {
      const [snapshotResp, changesResp] = handleDocumentLoad(validated as never, relay);
      send(state, snapshotResp);
      send(state, changesResp);
      break;
    }
    case "AuthenticateRequest": {
      // Already handled above — this satisfies exhaustive switch
      break;
    }
    default: {
      // Compile-time enforcement: all ClientMessageType values handled
      const _exhaustive: never = typedKey;
      void _exhaustive;
    }
  }
}

// ── Exports for testing ─────────────────────────────────────────────

export { relay as _testRelay };
