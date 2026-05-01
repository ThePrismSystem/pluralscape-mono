/**
 * WebSocket protocol message router.
 *
 * Implements a state machine that dispatches incoming JSON messages to the
 * appropriate handler based on the connection phase and message type.
 *
 * Per-message-type case bodies live in `message-router-cases.ts` to keep
 * this file under the area LOC ceiling. The send/access helpers below are
 * exported so the cases file can call them.
 */
import { syncDocuments } from "@pluralscape/db/pg";
import { EncryptedRelay } from "@pluralscape/sync";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";

import { getDb } from "../lib/db.js";
import { withTenantRead } from "../lib/rls-context.js";

import { handleAuthenticate } from "./auth-handler.js";
import {
  handleDocumentLoadRequestCase,
  handleFetchChangesRequestCase,
  handleFetchSnapshotRequestCase,
  handleManifestRequestCase,
  handleSubmitChangeRequestCase,
  handleSubmitSnapshotRequestCase,
  handleSubscribeRequestCase,
  handleUnsubscribeRequestCase,
  type CaseHelpers,
} from "./message-router-cases.js";
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

import type { SyncBroadcastPubSub } from "./broadcast.js";
import type { ConnectionManager } from "./connection-manager.js";
import type { SyncConnectionState } from "./connection-state.js";
import type { ClientMessageType } from "./message-schemas.js";
import type { AppLogger } from "../lib/logger.js";
import type { ServerMessage, SyncRelayService } from "@pluralscape/sync";
import type { SyncDocumentId, SystemId } from "@pluralscape/types";
import type { ZodType } from "zod";

// ── DI Context ───────────────────────────────────────────────────────

/** Dependencies injected into the router (testable without module singletons). */
export interface RouterContext {
  readonly relay: SyncRelayService;
  /**
   * Hot cache for document ownership. DB (sync_documents.system_id) is the
   * source of truth; the cache is populated on first access and updated on
   * writes.
   */
  readonly documentOwnership: Map<string, SystemId>;
  readonly manager: ConnectionManager;
  /** Valkey pub/sub for cross-instance broadcast. Null when Valkey is unavailable. */
  readonly pubsub: SyncBroadcastPubSub | null;
}

/** Create a RouterContext with linked relay eviction → ownership + subscription cleanup. */
export function createRouterContext(
  maxDocuments: number,
  manager: ConnectionManager,
  pubsub: SyncBroadcastPubSub | null = null,
): RouterContext {
  const documentOwnership = new Map<string, SystemId>();
  const relay = new EncryptedRelay({
    maxDocuments,
    onEvict: (docId) => {
      documentOwnership.delete(docId);
      manager.removeSubscriptionsForDoc(docId);
    },
  });
  return { relay: relay.asService(), documentOwnership, manager, pubsub };
}

// ── Type guards ──────────────────────────────────────────────────────

function isClientMessageType(type: string): type is ClientMessageType {
  return Object.hasOwn(CLIENT_MESSAGE_SCHEMAS, type);
}

function hasStringType(v: unknown): v is { type: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    "type" in v &&
    typeof (v as Record<string, unknown>)["type"] === "string"
  );
}

// ── Send helpers ────────────────────────────────────────────────────

/** Send a ServerMessage to a connection. Returns false if send failed. */
function send(state: SyncConnectionState, msg: ServerMessage, log: AppLogger): boolean {
  try {
    state.ws.send(serializeServerMessage(msg));
    return true;
  } catch (err: unknown) {
    log.warn("WebSocket send failed", {
      connectionId: state.connectionId,
      messageType: msg.type,
      error: formatError(err),
    });
    return false;
  }
}

export type SendFn = typeof send;

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
  // Log full Zod detail server-side, send sanitized message to client.
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

export type ParseMessageFn = typeof parseMessage;

/**
 * Check document access. Returns false and sends PERMISSION_DENIED on failure.
 *
 * Sec-M1: Uses in-memory cache as hot path; falls back to DB
 * (sync_documents.system_id) on cache miss to survive server restarts.
 */
async function checkAccess(
  docId: SyncDocumentId,
  systemId: SystemId,
  correlationId: string | null,
  state: SyncConnectionState,
  log: AppLogger,
  ownership: Map<string, SystemId>,
): Promise<boolean> {
  let owner = ownership.get(docId);

  // Cache miss — check DB for persisted ownership.
  if (owner === undefined && state.auth) {
    try {
      const db = await getDb();
      const rows = await withTenantRead(db, { systemId, accountId: state.auth.accountId }, (tx) =>
        tx
          .select({ systemId: syncDocuments.systemId })
          .from(syncDocuments)
          .where(eq(syncDocuments.documentId, docId))
          .limit(1),
      );
      const row = rows[0];
      if (row) {
        owner = brandId<SystemId>(row.systemId);
        ownership.set(docId, owner);
      }
    } catch (err: unknown) {
      log.error("Failed to query document ownership from DB — failing open", {
        docId,
        error: formatError(err),
      });
      // Fail open: the in-memory relay is still the primary gate, and E2E
      // encryption prevents data exposure regardless.
    }
  }

  if (owner !== undefined && owner !== systemId) {
    send(state, makeSyncError("PERMISSION_DENIED", "Access denied", correlationId, docId), log);
    return false;
  }
  return true;
}

export type CheckAccessFn = typeof checkAccess;

// ── Router ──────────────────────────────────────────────────────────

const HELPERS: CaseHelpers = { send, parseMessage, checkAccess };

/** Run the auth-phase exchange, returning whether routing should continue. */
async function handleAwaitingAuth(
  parsed: unknown,
  state: SyncConnectionState,
  log: AppLogger,
  ctx: RouterContext,
  messageType: string,
): Promise<void> {
  if (messageType !== "AuthenticateRequest") {
    sendErrorAndClose(
      state,
      makeSyncError("AUTH_FAILED", "Must authenticate first", null),
      WS_CLOSE_POLICY_VIOLATION,
      log,
    );
    return;
  }

  const result = CLIENT_MESSAGE_SCHEMAS.AuthenticateRequest.safeParse(parsed);
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

  const authResult = await handleAuthenticate(result.data, state, ctx.manager, log);
  if (authResult.ok) {
    send(state, authResult.response, log);
    log.info("WebSocket authenticated", {
      connectionId: state.connectionId,
      syncSessionId: authResult.response.syncSessionId,
    });
  } else {
    sendErrorAndClose(state, authResult.error, authResult.closeCode, log);
  }
}

/**
 * Apply the per-connection rate-limit. Returns false when the limit is hit
 * (the caller should stop processing the message).
 *
 * Security: the auth phase is time-bounded by WS_AUTH_TIMEOUT_MS (10 s) and
 * each connection processes at most one message before transitioning to the
 * authenticated phase, so rate-limiting auth-phase messages would add
 * complexity for negligible security gain.
 */
function applyRateLimit(
  state: SyncConnectionState & { phase: "authenticated" },
  messageType: ClientMessageType,
  log: AppLogger,
): boolean {
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
    return false;
  }
  // Decay strikes by 1 on successful message instead of resetting to 0.
  if (state.rateLimitStrikes > 0) {
    state.rateLimitStrikes--;
  }
  return true;
}

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

  // 2. Extract and validate type
  if (!hasStringType(parsed)) {
    sendErrorAndClose(
      state,
      makeSyncError("MALFORMED_MESSAGE", "Missing or invalid message type", null),
      WS_CLOSE_POLICY_VIOLATION,
      log,
    );
    return;
  }

  const messageType = parsed.type;

  // 3. Phase: awaiting-auth — only AuthenticateRequest allowed
  if (state.phase === "awaiting-auth") {
    await handleAwaitingAuth(parsed, state, log, ctx, messageType);
    return;
  }

  // At this point, TS narrows state to AuthenticatedState (awaiting-auth returns above).
  // state.systemId and state.auth are guaranteed non-null.

  // 4. Phase: authenticated — validate type is known
  if (!isClientMessageType(messageType)) {
    // Don't echo user input in error message (S13).
    send(state, makeSyncError("MALFORMED_MESSAGE", "Unknown message type", null), log);
    return;
  }

  // AuthenticateRequest is not valid after authentication.
  if (messageType === "AuthenticateRequest") {
    send(state, makeSyncError("MALFORMED_MESSAGE", "Already authenticated", null), log);
    return;
  }

  // 5. Rate limit check
  if (!applyRateLimit(state, messageType, log)) return;

  // 6. Validate and dispatch using helpers
  switch (messageType) {
    case "ManifestRequest":
      await handleManifestRequestCase(parsed, state, log, ctx, HELPERS);
      return;
    case "SubscribeRequest":
      await handleSubscribeRequestCase(parsed, state, log, ctx, HELPERS);
      return;
    case "UnsubscribeRequest":
      handleUnsubscribeRequestCase(parsed, state, log, ctx, HELPERS);
      return;
    case "FetchSnapshotRequest":
      await handleFetchSnapshotRequestCase(parsed, state, log, ctx, HELPERS);
      return;
    case "FetchChangesRequest":
      await handleFetchChangesRequestCase(parsed, state, log, ctx, HELPERS);
      return;
    case "SubmitChangeRequest":
      await handleSubmitChangeRequestCase(parsed, state, log, ctx, HELPERS);
      return;
    case "SubmitSnapshotRequest":
      await handleSubmitSnapshotRequestCase(parsed, state, log, ctx, HELPERS);
      return;
    case "DocumentLoadRequest":
      await handleDocumentLoadRequestCase(parsed, state, log, ctx, HELPERS);
      return;
    default: {
      // Compile-time enforcement: all ClientMessageType values handled.
      const _exhaustive: never = messageType;
      void _exhaustive;
    }
  }
}
