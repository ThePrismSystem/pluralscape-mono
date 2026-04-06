declare function setTimeout(fn: () => void, ms: number): number;
declare function clearTimeout(id: number): void;

import {
  AdapterDisposedError,
  SyncProtocolError,
  SyncTimeoutError,
  UnexpectedResponseError,
} from "../errors.js";
import { SYNC_PROTOCOL_VERSION } from "../protocol.js";

import type { EventBus } from "../event-bus/event-bus.js";
import type { DataLayerEventMap } from "../event-bus/event-map.js";
import type { ClientMessage, ServerMessage } from "../protocol.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { SyncManifest, SyncNetworkAdapter, SyncSubscription } from "./network-adapter.js";
import type { SyncDocumentId, SystemId } from "@pluralscape/types";

// ── Types ─────────────────────────────────────────────────────────────

/** Distributive Omit that preserves union members. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * Minimal WebSocket-like interface used by the adapter.
 * Both the global WebSocket and test mocks satisfy this contract.
 */
export interface MinimalWebSocket {
  readonly OPEN: number;
  readyState: number;
  onopen: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent | Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  send(data: string): void;
  close(): void;
}

/** Constructor for a MinimalWebSocket-compatible implementation. */
export type WebSocketConstructor = new (url: string) => MinimalWebSocket;

/** Configuration for the WebSocket client adapter. */
export interface WsClientAdapterConfig {
  readonly url: string;
  readonly token: string;
  readonly systemId: SystemId;
  readonly eventBus: EventBus<DataLayerEventMap>;
  readonly WebSocketImpl?: WebSocketConstructor;
}

/** Return type of createWsClientAdapter — SyncNetworkAdapter plus connection control. */
export type WsClientAdapter = SyncNetworkAdapter & {
  /** Open the WebSocket and perform the auth handshake. */
  connect(): void;
  /** Tear down the WebSocket and release resources. */
  disconnect(): void;
  /** Alias for disconnect(). Always present on WsClientAdapter. */
  close(): void;
};

// ── Constants ─────────────────────────────────────────────────────────

/** Default timeout for request/response pairs (ms). */
const REQUEST_TIMEOUT_MS = 30_000;

// ── Pending request bookkeeping ──────────────────────────────────────

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  timer: number;
}

// ── Incoming message shape (raw from WebSocket) ──────────────────────

/** Server-pushed notification message (not part of the sync protocol). */
interface NotificationMessage {
  readonly type: "Notification";
  readonly payload: unknown;
}

type IncomingMessage = ServerMessage | NotificationMessage;

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Creates a transport-agnostic WebSocket client that implements
 * {@link SyncNetworkAdapter}. The adapter demuxes incoming messages:
 *
 * - Sync responses with correlationId resolve pending request promises.
 * - `DocumentUpdate` pushes dispatch to subscription callbacks.
 * - `Notification` messages publish to the event bus as `ws:notification`.
 *
 * Lifecycle events (`ws:connected`, `ws:disconnected`) are also published
 * to the event bus.
 *
 * Call `connect()` to open the WebSocket and perform the auth handshake.
 * Call `disconnect()` to tear down cleanly.
 */
export function createWsClientAdapter(config: WsClientAdapterConfig): WsClientAdapter {
  const { url, token, systemId, eventBus } = config;
  const WebSocketImpl: WebSocketConstructor =
    config.WebSocketImpl ?? (globalThis.WebSocket as WebSocketConstructor);

  let ws: MinimalWebSocket | null = null;
  let disposed = false;

  /** Correlation-keyed pending requests. */
  const pending = new Map<string, PendingRequest<ServerMessage>>();

  /** Per-document subscription callback sets. */
  const subscriptions = new Map<
    string,
    Set<(changes: readonly EncryptedChangeEnvelope[]) => void>
  >();

  /** Highest known seq per document (for subscribe catch-up). */
  const lastSeqPerDoc = new Map<string, number>();

  /** Promise that resolves after the auth handshake completes. */
  let authReady: Promise<void> | null = null;
  let resolveAuth: (() => void) | null = null;
  let rejectAuth: ((err: Error) => void) | null = null;
  let authCorrelationId: string | null = null;

  // ── Helpers ──────────────────────────────────────────────────────

  function updateLastSeq(documentId: string, seq: number): void {
    const current = lastSeqPerDoc.get(documentId) ?? 0;
    if (seq > current) {
      lastSeqPerDoc.set(documentId, seq);
    }
  }

  function sendRaw(message: ClientMessage): void {
    if (!ws || ws.readyState !== ws.OPEN) {
      throw new AdapterDisposedError("WebSocket not connected");
    }
    ws.send(JSON.stringify(message));
  }

  function handleMessage(raw: IncomingMessage): void {
    if (disposed) return;

    // Notification messages → event bus
    if (raw.type === "Notification") {
      eventBus.emit("ws:notification", {
        type: "ws:notification",
        payload: raw.payload,
      });
      return;
    }

    const msg: ServerMessage = raw;

    // Auth response — resolve handshake promise and emit ws:connected
    if (msg.type === "AuthenticateResponse") {
      if (msg.correlationId !== authCorrelationId) return;
      authCorrelationId = null;
      resolveAuth?.();
      eventBus.emit("ws:connected", { type: "ws:connected" });
      return;
    }

    // Auth error during handshake
    if (
      msg.type === "SyncError" &&
      (msg.code === "AUTH_FAILED" || msg.code === "PROTOCOL_MISMATCH")
    ) {
      rejectAuth?.(new SyncProtocolError(msg.code, msg.message, msg.docId));
      // Also resolve any correlated pending request
    }

    // Server-pushed DocumentUpdate → subscription callbacks
    if (msg.type === "DocumentUpdate") {
      const callbacks = subscriptions.get(msg.docId);
      if (callbacks) {
        for (const cb of callbacks) {
          try {
            cb(msg.changes);
          } catch (err: unknown) {
            eventBus.emit("sync:error", {
              type: "sync:error",
              message: `DocumentUpdate subscriber error for ${msg.docId}`,
              error: err,
            });
          }
        }
      }
      const lastPushed = msg.changes[msg.changes.length - 1];
      if (lastPushed) updateLastSeq(msg.docId, lastPushed.seq);
      return;
    }

    // Correlated response → resolve pending request
    if (msg.correlationId) {
      const req = pending.get(msg.correlationId);
      if (req) {
        clearTimeout(req.timer);
        pending.delete(msg.correlationId);
        req.resolve(msg);
      }
    }
  }

  function expectResponse<T extends ServerMessage["type"]>(
    response: ServerMessage,
    expectedType: T,
  ): Extract<ServerMessage, { type: T }> {
    if (response.type === "SyncError") {
      throw new SyncProtocolError(response.code, response.message, response.docId);
    }
    if (response.type !== expectedType) {
      throw new UnexpectedResponseError(expectedType, response.type);
    }
    return response as Extract<ServerMessage, { type: T }>;
  }

  function request(
    message: DistributiveOmit<ClientMessage, "correlationId">,
  ): Promise<ServerMessage> {
    if (disposed) {
      return Promise.reject(new AdapterDisposedError());
    }

    const correlationId = crypto.randomUUID();
    const fullMessage = { ...message, correlationId } as ClientMessage;

    return new Promise<ServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(correlationId);
        reject(new SyncTimeoutError(message.type));
      }, REQUEST_TIMEOUT_MS);

      pending.set(correlationId, { resolve, reject, timer });

      try {
        sendRaw(fullMessage);
      } catch (err: unknown) {
        clearTimeout(timer);
        pending.delete(correlationId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  function cleanUp(reason: string): void {
    if (disposed) return;
    disposed = true;

    for (const [, req] of pending) {
      clearTimeout(req.timer);
      req.reject(new AdapterDisposedError());
    }
    pending.clear();
    subscriptions.clear();
    lastSeqPerDoc.clear();

    eventBus.emit("ws:disconnected", {
      type: "ws:disconnected",
      reason,
    });
  }

  // ── SyncNetworkAdapter methods ─────────────────────────────────

  async function submitChange(
    documentId: SyncDocumentId,
    change: Omit<EncryptedChangeEnvelope, "seq">,
  ): Promise<EncryptedChangeEnvelope> {
    await authReady;
    const response = await request({
      type: "SubmitChangeRequest",
      docId: documentId,
      change,
    });

    const accepted = expectResponse(response, "ChangeAccepted");
    updateLastSeq(documentId, accepted.assignedSeq);
    return { ...change, documentId, seq: accepted.assignedSeq };
  }

  async function fetchChangesSince(
    documentId: SyncDocumentId,
    sinceSeq: number,
  ): Promise<readonly EncryptedChangeEnvelope[]> {
    await authReady;
    const response = await request({
      type: "FetchChangesRequest",
      docId: documentId,
      sinceSeq,
    });

    const changesResp = expectResponse(response, "ChangesResponse");
    const last = changesResp.changes[changesResp.changes.length - 1];
    if (last) updateLastSeq(documentId, last.seq);
    return changesResp.changes;
  }

  async function submitSnapshot(
    documentId: SyncDocumentId,
    snapshot: EncryptedSnapshotEnvelope,
  ): Promise<void> {
    await authReady;
    const response = await request({
      type: "SubmitSnapshotRequest",
      docId: documentId,
      snapshot,
    });

    if (response.type === "SyncError") {
      if (response.code === "VERSION_CONFLICT") return;
      throw new SyncProtocolError(response.code, response.message, response.docId);
    }
    if (response.type !== "SnapshotAccepted") {
      throw new UnexpectedResponseError("SnapshotAccepted", response.type);
    }
  }

  async function fetchLatestSnapshot(
    documentId: SyncDocumentId,
  ): Promise<EncryptedSnapshotEnvelope | null> {
    await authReady;
    const response = await request({
      type: "FetchSnapshotRequest",
      docId: documentId,
    });

    const snapshotResp = expectResponse(response, "SnapshotResponse");
    return snapshotResp.snapshot;
  }

  function subscribe(
    documentId: SyncDocumentId,
    onChanges: (changes: readonly EncryptedChangeEnvelope[]) => void,
  ): SyncSubscription {
    let callbacks = subscriptions.get(documentId);
    if (!callbacks) {
      callbacks = new Set();
      subscriptions.set(documentId, callbacks);
    }
    callbacks.add(onChanges);

    // Fire-and-forget subscribe request
    const lastSeq = lastSeqPerDoc.get(documentId) ?? 0;
    void authReady
      ?.then(() => {
        sendRaw({
          type: "SubscribeRequest",
          correlationId: crypto.randomUUID(),
          documents: [{ docId: documentId, lastSyncedSeq: lastSeq, lastSnapshotVersion: 0 }],
        });
      })
      .catch(() => {
        // Connection may have been lost — subscription will be re-established on reconnect
      });

    return {
      unsubscribe: () => {
        callbacks.delete(onChanges);
        if (callbacks.size === 0) {
          subscriptions.delete(documentId);
          void authReady
            ?.then(() => {
              sendRaw({
                type: "UnsubscribeRequest",
                correlationId: crypto.randomUUID(),
                docId: documentId,
              });
            })
            .catch(() => {
              // Connection may have been lost — unsubscribe is best-effort
            });
        }
      },
    };
  }

  async function fetchManifest(sysIdParam: SystemId): Promise<SyncManifest> {
    await authReady;
    const response = await request({
      type: "ManifestRequest",
      systemId: sysIdParam,
    });

    const manifestResp = expectResponse(response, "ManifestResponse");
    return manifestResp.manifest;
  }

  // ── Connection control ──────────────────────────────────────────

  function connect(): void {
    if (disposed) return;

    authReady = new Promise<void>((resolve, reject) => {
      resolveAuth = resolve;
      rejectAuth = reject;
    });

    ws = new WebSocketImpl(url);

    ws.onopen = () => {
      if (disposed) return;
      authCorrelationId = crypto.randomUUID();
      sendRaw({
        type: "AuthenticateRequest",
        correlationId: authCorrelationId,
        protocolVersion: SYNC_PROTOCOL_VERSION,
        sessionToken: token,
        systemId,
        profileType: "owner-full",
      });
    };

    ws.onmessage = (event: MessageEvent) => {
      if (disposed) return;
      try {
        const parsed = JSON.parse(String(event.data)) as IncomingMessage;
        handleMessage(parsed);
      } catch (err: unknown) {
        eventBus.emit("sync:error", {
          type: "sync:error",
          message: "Failed to parse incoming WebSocket message",
          error: err,
        });
      }
    };

    ws.onclose = () => {
      cleanUp("connection closed");
    };

    ws.onerror = () => {
      cleanUp("connection error");
    };
  }

  function disconnect(): void {
    if (ws) {
      // Prevent onclose from firing cleanUp again
      const socket = ws;
      ws = null;
      cleanUp("client disconnected");
      socket.close();
    } else {
      cleanUp("client disconnected");
    }
  }

  function close(): void {
    disconnect();
  }

  return {
    submitChange,
    fetchChangesSince,
    submitSnapshot,
    fetchLatestSnapshot,
    subscribe,
    fetchManifest,
    close,
    connect,
    disconnect,
  };
}
