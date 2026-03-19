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

import type { ConnectionManager } from "./connection-manager.js";
import type { AuthenticatedState, SyncConnectionState } from "./connection-state.js";
import type { ClientMessageType } from "./message-schemas.js";
import type { AppLogger } from "../lib/logger.js";
import type {
  ServerMessage,
  SubmitChangeRequest,
  SubmitSnapshotRequest,
  SyncError,
} from "@pluralscape/sync";
import type { ZodType } from "zod";

// ── DI Context ───────────────────────────────────────────────────────

/** Dependencies injected into the router (testable without module singletons). */
export interface RouterContext {
  readonly relay: EncryptedRelay;
  readonly documentOwnership: Map<string, string>;
}

/** Create a RouterContext with linked relay eviction → ownership cleanup. */
export function createRouterContext(maxDocuments: number): RouterContext {
  const documentOwnership = new Map<string, string>();
  const relay = new EncryptedRelay({
    maxDocuments,
    onEvict: (docId) => {
      documentOwnership.delete(docId);
    },
  });
  return { relay, documentOwnership };
}

// ── Type guard ───────────────────────────────────────────────────────

function isClientMessageType(type: string): type is ClientMessageType {
  return Object.hasOwn(CLIENT_MESSAGE_SCHEMAS, type);
}

// ── Document access ──────────────────────────────────────────────────

/** Check whether systemId is allowed to access docId. */
function checkDocumentAccess(
  docId: string,
  systemId: string,
  ownership: Map<string, string>,
): boolean {
  const owner = ownership.get(docId);
  return owner === undefined || owner === systemId;
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
  zodError: { issues: Array<{ message?: string }> },
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

/** Check document access. Returns false and sends PERMISSION_DENIED on failure. */
function checkAccess(
  docId: string,
  systemId: string,
  correlationId: string | null,
  state: SyncConnectionState,
  log: AppLogger,
  ownership: Map<string, string>,
): boolean {
  if (!checkDocumentAccess(docId, systemId, ownership)) {
    send(
      state,
      {
        type: "SyncError",
        correlationId,
        code: "PERMISSION_DENIED",
        message: "Access denied",
        docId,
      },
      log,
    );
    return false;
  }
  return true;
}

// ── Sliding window rate limiting ─────────────────────────────────────

function checkRateLimit(state: AuthenticatedState, isMutation: boolean): boolean {
  const now = Date.now();
  const windowMs = isMutation ? WS_MUTATION_RATE_WINDOW_MS : WS_READ_RATE_WINDOW_MS;
  const limit = isMutation ? WS_MUTATION_RATE_LIMIT : WS_READ_RATE_LIMIT;

  let count: number;
  let prevCount: number;
  let windowStart: number;

  if (isMutation) {
    count = state.mutationCount;
    prevCount = state.mutationPreviousCount;
    windowStart = state.mutationWindowStart;
  } else {
    count = state.readCount;
    prevCount = state.readPreviousCount;
    windowStart = state.readWindowStart;
  }

  const doubleWindow = 2;
  if (now - windowStart >= doubleWindow * windowMs) {
    // Both windows expired
    prevCount = 0;
    count = 0;
    windowStart = now;
  } else if (now - windowStart >= windowMs) {
    // Current window expired — rotate
    prevCount = count;
    count = 0;
    windowStart = now;
  }
  count++;

  // Interpolate: weight previous window by overlap fraction
  const elapsed = now - windowStart;
  const weight = Math.max(0, 1 - elapsed / windowMs);
  const effectiveCount = prevCount * weight + count;

  // Write back
  if (isMutation) {
    state.mutationCount = count;
    state.mutationPreviousCount = prevCount;
    state.mutationWindowStart = windowStart;
  } else {
    state.readCount = count;
    state.readPreviousCount = prevCount;
    state.readWindowStart = windowStart;
  }

  return effectiveCount <= limit;
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
  ctx: RouterContext,
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
        syncSessionId: authResult.response.syncSessionId,
      });
    } else {
      sendErrorAndClose(state, authResult.error, authResult.closeCode, log);
    }
    return;
  }

  // At this point, TS narrows state to AuthenticatedState (closing returns above,
  // awaiting-auth returns above). state.systemId and state.auth are guaranteed non-null.

  // 4. Phase: authenticated — validate type is known
  if (!isClientMessageType(messageType)) {
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

  // 5. Rate limit check
  const isMutation = MUTATION_MESSAGE_TYPES.has(messageType);
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
      for (const entry of msg.documents) {
        if (
          !checkAccess(
            entry.docId,
            state.systemId,
            msg.correlationId,
            state,
            log,
            documentOwnership,
          )
        )
          return;
      }
      send(state, handleSubscribeRequest(msg, state, manager, relay), log);
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
      const msg = parseMessage(
        CLIENT_MESSAGE_SCHEMAS.FetchSnapshotRequest,
        parsed,
        state,
        messageType,
        log,
      );
      if (!msg) return;
      if (!checkAccess(msg.docId, state.systemId, msg.correlationId, state, log, documentOwnership))
        return;
      send(state, handleFetchSnapshot(msg, relay), log);
      break;
    }
    case "FetchChangesRequest": {
      const msg = parseMessage(
        CLIENT_MESSAGE_SCHEMAS.FetchChangesRequest,
        parsed,
        state,
        messageType,
        log,
      );
      if (!msg) return;
      if (!checkAccess(msg.docId, state.systemId, msg.correlationId, state, log, documentOwnership))
        return;
      send(state, handleFetchChanges(msg, relay), log);
      break;
    }
    case "SubmitChangeRequest": {
      // Boundary cast: Zod outputs plain Uint8Array, protocol types use branded crypto types
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
      const { response, sequencedEnvelope } = handleSubmitChange(msg, relay);
      send(state, response, log);
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
      // Boundary cast: Zod outputs plain Uint8Array, protocol types use branded crypto types
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
      send(state, snapshotResp, log);
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
