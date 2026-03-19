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
  WS_RATE_LIMIT_STRIKE_MAX,
  WS_READ_RATE_LIMIT,
  WS_READ_RATE_WINDOW_MS,
  WS_RELAY_MAX_DOCUMENTS,
} from "./ws.constants.js";

import type { ConnectionManager } from "./connection-manager.js";
import type { SyncConnectionState } from "./connection-state.js";
import type { ClientMessageType } from "./message-schemas.js";
import type { AppLogger } from "../lib/logger.js";
import type {
  ServerMessage,
  SubmitChangeRequest,
  SubmitSnapshotRequest,
  SyncError,
} from "@pluralscape/sync";
import type { ZodError } from "zod";

// ── Singleton relay (Phase 1: in-memory) ────────────────────────────

const relay = new EncryptedRelay({
  maxDocuments: WS_RELAY_MAX_DOCUMENTS,
  onEvict: (docId) => {
    documentOwnership.delete(docId);
  },
});

// ── Document ownership (Phase 1: in-memory ACL) ────────────────────

/**
 * Maps docId → systemId of the first writer. Used to enforce that only
 * the owning system can read or write a document. Unowned documents
 * (never written to) are accessible to any authenticated connection.
 */
const documentOwnership = new Map<string, string>();

/** Check whether systemId is allowed to access docId. */
function checkDocumentAccess(docId: string, systemId: string): boolean {
  const owner = documentOwnership.get(docId);
  return owner === undefined || owner === systemId;
}

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

/** Send a ServerMessage to a connection. Returns false if send failed. */
function send(state: SyncConnectionState, msg: ServerMessage, log: AppLogger): boolean {
  try {
    state.ws.send(serializeResponse(msg));
    return true;
  } catch (err) {
    log.warn("WebSocket send failed", {
      connectionId: state.connectionId,
      messageType: msg.type,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Send a SyncError and close the connection. */
function sendErrorAndClose(
  state: SyncConnectionState,
  error: SyncError,
  closeCode: number,
  log: AppLogger,
): void {
  send(state, error, log);
  try {
    state.ws.close(closeCode, error.message);
  } catch {
    // Already closed
  }
}

/** Send a validation error for a specific message type. */
function sendValidationError(
  state: SyncConnectionState,
  messageType: string,
  zodError: ZodError,
  log: AppLogger,
): void {
  const detail = zodError.issues[0]?.message ?? "Validation failed";
  send(
    state,
    {
      type: "SyncError",
      correlationId: null,
      code: "MALFORMED_MESSAGE",
      message: `Invalid ${messageType}: ${detail}`,
      docId: null,
    },
    log,
  );
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
      log,
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
      log,
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
      log,
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
        log,
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
        log,
      );
      return;
    }

    const authResult = await handleAuthenticate(result.data, state, manager);
    if (authResult.ok) {
      send(state, authResult.response, log);
      log.info("WebSocket authenticated", {
        connectionId: state.connectionId,
        accountId: state.auth?.accountId,
      });
    } else {
      sendErrorAndClose(state, authResult.error, authResult.closeCode, log);
    }
    return;
  }

  // 4. Phase: authenticated — validate type is known
  if (!Object.hasOwn(CLIENT_MESSAGE_SCHEMAS, messageType)) {
    send(
      state,
      {
        type: "SyncError",
        correlationId: null,
        code: "MALFORMED_MESSAGE",
        message: `Unknown message type: ${messageType}`,
        docId: null,
      },
      log,
    );
    return;
  }

  // AuthenticateRequest is not valid after authentication
  if (messageType === "AuthenticateRequest") {
    send(
      state,
      {
        type: "SyncError",
        correlationId: null,
        code: "MALFORMED_MESSAGE",
        message: "Already authenticated",
        docId: null,
      },
      log,
    );
    return;
  }

  // 5. Rate limit check (safe cast: Object.hasOwn guard proves messageType is a valid key)
  const isMutation = MUTATION_MESSAGE_TYPES.has(messageType as ClientMessageType);
  if (!checkRateLimit(state, isMutation)) {
    state.rateLimitStrikes++;
    send(
      state,
      {
        type: "SyncError",
        correlationId: null,
        code: "RATE_LIMITED",
        message: "Too many messages",
        docId: null,
      },
      log,
    );
    if (state.rateLimitStrikes >= WS_RATE_LIMIT_STRIKE_MAX) {
      log.warn("Closing connection after repeated rate limit violations", {
        connectionId: state.connectionId,
        strikes: state.rateLimitStrikes,
      });
      try {
        state.ws.close(WS_CLOSE_POLICY_VIOLATION, "Rate limit exceeded");
      } catch {
        // Already closed
      }
    }
    return;
  }
  state.rateLimitStrikes = 0;

  // 6. Validate and dispatch — each branch validates with its specific schema,
  // giving TypeScript perfect type inference without `as never` casts.
  // Safe cast: Object.hasOwn guard above proves messageType is a valid key.
  const typedMessageType = messageType as ClientMessageType;
  switch (typedMessageType) {
    case "ManifestRequest": {
      const result = CLIENT_MESSAGE_SCHEMAS.ManifestRequest.safeParse(parsed);
      if (!result.success) {
        sendValidationError(state, messageType, result.error, log);
        return;
      }
      const response = handleManifestRequest(result.data);
      send(state, response, log);
      break;
    }
    case "SubscribeRequest": {
      const result = CLIENT_MESSAGE_SCHEMAS.SubscribeRequest.safeParse(parsed);
      if (!result.success) {
        sendValidationError(state, messageType, result.error, log);
        return;
      }
      for (const entry of result.data.documents) {
        if (!checkDocumentAccess(entry.docId, state.systemId ?? "")) {
          send(
            state,
            {
              type: "SyncError",
              correlationId: result.data.correlationId,
              code: "PERMISSION_DENIED",
              message: "Access denied",
              docId: entry.docId,
            },
            log,
          );
          return;
        }
      }
      const response = handleSubscribeRequest(result.data, state, manager, relay);
      send(state, response, log);
      break;
    }
    case "UnsubscribeRequest": {
      const result = CLIENT_MESSAGE_SCHEMAS.UnsubscribeRequest.safeParse(parsed);
      if (!result.success) {
        sendValidationError(state, messageType, result.error, log);
        return;
      }
      handleUnsubscribeRequest(result.data, state, manager);
      break;
    }
    case "FetchSnapshotRequest": {
      const result = CLIENT_MESSAGE_SCHEMAS.FetchSnapshotRequest.safeParse(parsed);
      if (!result.success) {
        sendValidationError(state, messageType, result.error, log);
        return;
      }
      if (!checkDocumentAccess(result.data.docId, state.systemId ?? "")) {
        send(
          state,
          {
            type: "SyncError",
            correlationId: result.data.correlationId,
            code: "PERMISSION_DENIED",
            message: "Access denied",
            docId: result.data.docId,
          },
          log,
        );
        return;
      }
      const response = handleFetchSnapshot(result.data, relay);
      send(state, response, log);
      break;
    }
    case "FetchChangesRequest": {
      const result = CLIENT_MESSAGE_SCHEMAS.FetchChangesRequest.safeParse(parsed);
      if (!result.success) {
        sendValidationError(state, messageType, result.error, log);
        return;
      }
      if (!checkDocumentAccess(result.data.docId, state.systemId ?? "")) {
        send(
          state,
          {
            type: "SyncError",
            correlationId: result.data.correlationId,
            code: "PERMISSION_DENIED",
            message: "Access denied",
            docId: result.data.docId,
          },
          log,
        );
        return;
      }
      const response = handleFetchChanges(result.data, relay);
      send(state, response, log);
      break;
    }
    case "SubmitChangeRequest": {
      const result = CLIENT_MESSAGE_SCHEMAS.SubmitChangeRequest.safeParse(parsed);
      if (!result.success) {
        sendValidationError(state, messageType, result.error, log);
        return;
      }
      // Boundary cast: Zod outputs plain Uint8Array, protocol types use branded crypto types
      const msg = result.data as SubmitChangeRequest;
      if (!checkDocumentAccess(msg.docId, state.systemId ?? "")) {
        send(
          state,
          {
            type: "SyncError",
            correlationId: msg.correlationId,
            code: "PERMISSION_DENIED",
            message: "Access denied",
            docId: msg.docId,
          },
          log,
        );
        return;
      }
      const response = handleSubmitChange(msg, relay);
      send(state, response, log);
      documentOwnership.set(msg.docId, state.systemId ?? "");

      // Broadcast DocumentUpdate to all subscribers except submitter
      broadcastDocumentUpdate(
        {
          type: "DocumentUpdate",
          correlationId: null,
          docId: msg.docId,
          changes: [{ ...msg.change, documentId: msg.docId, seq: response.assignedSeq }],
        },
        state.connectionId,
        manager,
        log,
      );
      break;
    }
    case "SubmitSnapshotRequest": {
      const result = CLIENT_MESSAGE_SCHEMAS.SubmitSnapshotRequest.safeParse(parsed);
      if (!result.success) {
        sendValidationError(state, messageType, result.error, log);
        return;
      }
      // Boundary cast: Zod outputs plain Uint8Array, protocol types use branded crypto types
      const msg = result.data as SubmitSnapshotRequest;
      if (!checkDocumentAccess(msg.docId, state.systemId ?? "")) {
        send(
          state,
          {
            type: "SyncError",
            correlationId: msg.correlationId,
            code: "PERMISSION_DENIED",
            message: "Access denied",
            docId: msg.docId,
          },
          log,
        );
        return;
      }
      const response = handleSubmitSnapshot(msg, relay);
      send(state, response, log);
      documentOwnership.set(msg.docId, state.systemId ?? "");
      break;
    }
    case "DocumentLoadRequest": {
      const result = CLIENT_MESSAGE_SCHEMAS.DocumentLoadRequest.safeParse(parsed);
      if (!result.success) {
        sendValidationError(state, messageType, result.error, log);
        return;
      }
      if (!checkDocumentAccess(result.data.docId, state.systemId ?? "")) {
        send(
          state,
          {
            type: "SyncError",
            correlationId: result.data.correlationId,
            code: "PERMISSION_DENIED",
            message: "Access denied",
            docId: result.data.docId,
          },
          log,
        );
        return;
      }
      const [snapshotResp, changesResp] = handleDocumentLoad(result.data, relay);
      send(state, snapshotResp, log);
      send(state, changesResp, log);
      break;
    }
    case "AuthenticateRequest": {
      // Already handled above — this satisfies exhaustive switch
      break;
    }
    default: {
      // Compile-time enforcement: all ClientMessageType values handled
      const _exhaustive: never = typedMessageType;
      void _exhaustive;
    }
  }
}

// ── Exports for testing ─────────────────────────────────────────────

export { relay as _testRelay };
export { documentOwnership as _testDocumentOwnership };
