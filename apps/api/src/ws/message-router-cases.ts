/**
 * Per-message-type case handlers for the WebSocket router.
 *
 * Each function corresponds to one {@link ClientMessageType} after the
 * authenticated phase. They share the access/parsing helpers exported from
 * `message-router.ts` and own the docId-level access check + per-handler
 * try/catch contract.
 *
 * Extracted from `message-router.ts` to keep the router file under the area
 * LOC ceiling. Internal to the ws module — consumers continue to call
 * `routeMessage` from `message-router.ts`.
 */
import { syncDocuments } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { inArray } from "drizzle-orm";

import { getDb } from "../lib/db.js";
import { withTenantRead } from "../lib/rls-context.js";

import { broadcastDocumentUpdateWithSync } from "./broadcast.js";
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
import { CLIENT_MESSAGE_SCHEMAS } from "./message-schemas.js";
import { formatError, makeSyncError } from "./ws.utils.js";

import type { AuthenticatedState } from "./connection-state.js";
import type { CheckAccessFn, ParseMessageFn, RouterContext, SendFn } from "./message-router.js";
import type { AppLogger } from "../lib/logger.js";
import type { DocumentVersionEntry } from "@pluralscape/sync";
import type { SystemId } from "@pluralscape/types";

/** Helpers wired by `routeMessage` so cases stay testable independently of module state. */
export interface CaseHelpers {
  readonly send: SendFn;
  readonly parseMessage: ParseMessageFn;
  readonly checkAccess: CheckAccessFn;
}

export async function handleManifestRequestCase(
  parsed: unknown,
  state: AuthenticatedState,
  log: AppLogger,
  ctx: RouterContext,
  helpers: CaseHelpers,
): Promise<void> {
  const msg = helpers.parseMessage(
    CLIENT_MESSAGE_SCHEMAS.ManifestRequest,
    parsed,
    state,
    "ManifestRequest",
    log,
  );
  if (!msg) return;
  // C3: Verify systemId matches the authenticated connection
  if (msg.systemId !== state.systemId) {
    helpers.send(
      state,
      makeSyncError("PERMISSION_DENIED", "System ID mismatch", msg.correlationId),
      log,
    );
    return;
  }
  try {
    const response = await handleManifestRequest(msg, ctx.relay);
    helpers.send(state, response, log);
  } catch (err: unknown) {
    log.error("handleManifestRequest threw", {
      connectionId: state.connectionId,
      error: formatError(err),
    });
    helpers.send(
      state,
      makeSyncError("INTERNAL_ERROR", "Failed to process manifest", msg.correlationId),
      log,
    );
  }
}

export async function handleSubscribeRequestCase(
  parsed: unknown,
  state: AuthenticatedState,
  log: AppLogger,
  ctx: RouterContext,
  helpers: CaseHelpers,
): Promise<void> {
  const msg = helpers.parseMessage(
    CLIENT_MESSAGE_SCHEMAS.SubscribeRequest,
    parsed,
    state,
    "SubscribeRequest",
    log,
  );
  if (!msg) return;
  // I17: Check each doc individually; subscribe permitted ones, deny denied ones.
  // Pre-warm ownership cache in a single batch query to avoid N sequential DB hits.
  const uncachedDocIds = msg.documents
    .map((e) => e.docId)
    .filter((id) => !ctx.documentOwnership.has(id));
  if (uncachedDocIds.length > 0) {
    try {
      const db = await getDb();
      const rows = await withTenantRead(
        db,
        { systemId: state.systemId, accountId: state.auth.accountId },
        (tx) =>
          tx
            .select({ documentId: syncDocuments.documentId, systemId: syncDocuments.systemId })
            .from(syncDocuments)
            .where(inArray(syncDocuments.documentId, uncachedDocIds)),
      );
      for (const row of rows) {
        ctx.documentOwnership.set(row.documentId, brandId<SystemId>(row.systemId));
      }
    } catch (err: unknown) {
      log.error("Failed to batch-query document ownership from DB", {
        error: formatError(err),
      });
      // Fail open — individual checkAccess calls will also fail open on cache miss.
    }
  }
  const permitted: DocumentVersionEntry[] = [];
  for (const entry of msg.documents) {
    if (
      await helpers.checkAccess(
        entry.docId,
        state.systemId,
        msg.correlationId,
        state,
        log,
        ctx.documentOwnership,
      )
    ) {
      permitted.push(entry);
    }
    // Denied docs get a PERMISSION_DENIED sent by checkAccess; continue with rest.
  }
  try {
    const response = await handleSubscribeRequest(
      { ...msg, documents: permitted },
      state,
      ctx.manager,
      ctx.relay,
      log,
    );
    helpers.send(state, response, log);
  } catch (err: unknown) {
    log.error("handleSubscribeRequest threw", {
      connectionId: state.connectionId,
      error: formatError(err),
    });
    helpers.send(
      state,
      makeSyncError("INTERNAL_ERROR", "Failed to process subscription", msg.correlationId),
      log,
    );
  }
}

export function handleUnsubscribeRequestCase(
  parsed: unknown,
  state: AuthenticatedState,
  log: AppLogger,
  ctx: RouterContext,
  helpers: CaseHelpers,
): void {
  const msg = helpers.parseMessage(
    CLIENT_MESSAGE_SCHEMAS.UnsubscribeRequest,
    parsed,
    state,
    "UnsubscribeRequest",
    log,
  );
  if (!msg) return;
  handleUnsubscribeRequest(msg, state, ctx.manager);
}

export async function handleFetchSnapshotRequestCase(
  parsed: unknown,
  state: AuthenticatedState,
  log: AppLogger,
  ctx: RouterContext,
  helpers: CaseHelpers,
): Promise<void> {
  const msg = helpers.parseMessage(
    CLIENT_MESSAGE_SCHEMAS.FetchSnapshotRequest,
    parsed,
    state,
    "FetchSnapshotRequest",
    log,
  );
  if (!msg) return;
  if (
    !(await helpers.checkAccess(
      msg.docId,
      state.systemId,
      msg.correlationId,
      state,
      log,
      ctx.documentOwnership,
    ))
  )
    return;
  try {
    const response = await handleFetchSnapshot(msg, ctx.relay);
    helpers.send(state, response, log);
  } catch (err: unknown) {
    log.error("handleFetchSnapshot threw", {
      connectionId: state.connectionId,
      docId: msg.docId,
      error: formatError(err),
    });
    helpers.send(
      state,
      makeSyncError(
        "INTERNAL_ERROR",
        "Failed to process FetchSnapshotRequest",
        msg.correlationId,
        msg.docId,
      ),
      log,
    );
  }
}

export async function handleFetchChangesRequestCase(
  parsed: unknown,
  state: AuthenticatedState,
  log: AppLogger,
  ctx: RouterContext,
  helpers: CaseHelpers,
): Promise<void> {
  const msg = helpers.parseMessage(
    CLIENT_MESSAGE_SCHEMAS.FetchChangesRequest,
    parsed,
    state,
    "FetchChangesRequest",
    log,
  );
  if (!msg) return;
  if (
    !(await helpers.checkAccess(
      msg.docId,
      state.systemId,
      msg.correlationId,
      state,
      log,
      ctx.documentOwnership,
    ))
  )
    return;
  try {
    const response = await handleFetchChanges(msg, ctx.relay);
    helpers.send(state, response, log);
  } catch (err: unknown) {
    log.error("handleFetchChanges threw", {
      connectionId: state.connectionId,
      docId: msg.docId,
      error: formatError(err),
    });
    helpers.send(
      state,
      makeSyncError(
        "INTERNAL_ERROR",
        "Failed to process FetchChangesRequest",
        msg.correlationId,
        msg.docId,
      ),
      log,
    );
  }
}

export async function handleSubmitChangeRequestCase(
  parsed: unknown,
  state: AuthenticatedState,
  log: AppLogger,
  ctx: RouterContext,
  helpers: CaseHelpers,
): Promise<void> {
  const msg = helpers.parseMessage(
    CLIENT_MESSAGE_SCHEMAS.SubmitChangeRequest,
    parsed,
    state,
    "SubmitChangeRequest",
    log,
  );
  if (!msg) return;
  if (
    !(await helpers.checkAccess(
      msg.docId,
      state.systemId,
      msg.correlationId,
      state,
      log,
      ctx.documentOwnership,
    ))
  )
    return;
  try {
    const db = await getDb();
    const result = await handleSubmitChange(msg, ctx.relay, db, state.auth.accountId);
    if (result.type === "SyncError") {
      helpers.send(state, result, log);
      return;
    }
    if (!helpers.send(state, result.response, log)) return;
    // Post-success: set ownership and broadcast to other subscribers.
    try {
      ctx.documentOwnership.set(msg.docId, state.systemId);
      const broadcastResult = await broadcastDocumentUpdateWithSync(
        {
          type: "DocumentUpdate",
          correlationId: null,
          docId: msg.docId,
          changes: [result.sequencedEnvelope],
        },
        state.connectionId,
        ctx.manager,
        log,
        ctx.pubsub,
      );
      if (broadcastResult.syncPublished === false) {
        log.warn("Cross-instance sync publish failed for SubmitChangeRequest", {
          connectionId: state.connectionId,
          docId: msg.docId,
        });
      }
    } catch (err: unknown) {
      log.error("Post-submit side-effect failed for SubmitChangeRequest", {
        connectionId: state.connectionId,
        docId: msg.docId,
        error: formatError(err),
      });
    }
  } catch (err: unknown) {
    log.error("handleSubmitChange threw", {
      connectionId: state.connectionId,
      docId: msg.docId,
      error: formatError(err),
    });
    helpers.send(
      state,
      makeSyncError(
        "INTERNAL_ERROR",
        "Failed to process SubmitChangeRequest",
        msg.correlationId,
        msg.docId,
      ),
      log,
    );
  }
}

export async function handleSubmitSnapshotRequestCase(
  parsed: unknown,
  state: AuthenticatedState,
  log: AppLogger,
  ctx: RouterContext,
  helpers: CaseHelpers,
): Promise<void> {
  const msg = helpers.parseMessage(
    CLIENT_MESSAGE_SCHEMAS.SubmitSnapshotRequest,
    parsed,
    state,
    "SubmitSnapshotRequest",
    log,
  );
  if (!msg) return;
  if (
    !(await helpers.checkAccess(
      msg.docId,
      state.systemId,
      msg.correlationId,
      state,
      log,
      ctx.documentOwnership,
    ))
  )
    return;
  try {
    const db = await getDb();
    const response = await handleSubmitSnapshot(msg, ctx.relay, db, state.auth.accountId);
    if (!helpers.send(state, response, log)) return;
    // Post-success: set ownership only on non-error responses.
    if (response.type !== "SyncError") {
      ctx.documentOwnership.set(msg.docId, state.systemId);
    }
  } catch (err: unknown) {
    log.error("handleSubmitSnapshot threw", {
      connectionId: state.connectionId,
      docId: msg.docId,
      error: formatError(err),
    });
    helpers.send(
      state,
      makeSyncError(
        "INTERNAL_ERROR",
        "Failed to process SubmitSnapshotRequest",
        msg.correlationId,
        msg.docId,
      ),
      log,
    );
  }
}

export async function handleDocumentLoadRequestCase(
  parsed: unknown,
  state: AuthenticatedState,
  log: AppLogger,
  ctx: RouterContext,
  helpers: CaseHelpers,
): Promise<void> {
  const msg = helpers.parseMessage(
    CLIENT_MESSAGE_SCHEMAS.DocumentLoadRequest,
    parsed,
    state,
    "DocumentLoadRequest",
    log,
  );
  if (!msg) return;
  if (
    !(await helpers.checkAccess(
      msg.docId,
      state.systemId,
      msg.correlationId,
      state,
      log,
      ctx.documentOwnership,
    ))
  )
    return;
  try {
    const [snapshotResp, changesResp] = await handleDocumentLoad(msg, ctx.relay);
    // I10: Check first send succeeded before sending second.
    if (!helpers.send(state, snapshotResp, log)) return;
    helpers.send(state, changesResp, log);
  } catch (err: unknown) {
    log.error("handleDocumentLoad threw", {
      connectionId: state.connectionId,
      docId: msg.docId,
      error: formatError(err),
    });
    helpers.send(
      state,
      makeSyncError("INTERNAL_ERROR", "Failed to load document", msg.correlationId, msg.docId),
      log,
    );
  }
}
