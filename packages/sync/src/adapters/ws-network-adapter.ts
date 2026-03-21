declare function setTimeout(fn: () => void, ms: number): number;
declare function clearTimeout(id: number): void;

import {
  AdapterDisposedError,
  SyncProtocolError,
  SyncTimeoutError,
  UnexpectedResponseError,
} from "../errors.js";

import type { ClientMessage, ServerMessage, SyncTransport } from "../protocol.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { SyncManifest, SyncNetworkAdapter, SyncSubscription } from "./network-adapter.js";
import type { Logger } from "@pluralscape/types";

/** Distributive Omit that preserves union members. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Default timeout for request/response pairs (ms). */
const REQUEST_TIMEOUT_MS = 30_000;

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  timer: number;
}

/**
 * WebSocket-backed SyncNetworkAdapter.
 *
 * Maps adapter methods to client/server message pairs using correlation IDs.
 * Supports subscriptions with real-time DocumentUpdate pushes.
 *
 * Auto-disposes when the underlying transport closes or errors.
 */
export class WsNetworkAdapter implements SyncNetworkAdapter {
  private readonly transport: SyncTransport;
  private readonly pending = new Map<string, PendingRequest<ServerMessage>>();
  private readonly subscriptions = new Map<
    string,
    Set<(changes: readonly EncryptedChangeEnvelope[]) => void>
  >();
  private readonly lastSeqPerDoc = new Map<string, number>();
  private readonly timeoutMs: number;
  private readonly logger?: Pick<Logger, "warn">;
  private disposed = false;

  constructor(
    transport: SyncTransport,
    timeoutMs = REQUEST_TIMEOUT_MS,
    logger?: Pick<Logger, "warn">,
  ) {
    this.transport = transport;
    this.timeoutMs = timeoutMs;
    this.logger = logger;

    transport.onMessage((msg) => {
      this.handleMessage(msg);
    });

    // M12: Auto-close when transport closes
    transport.onClose?.(() => {
      this.close();
    });
  }

  async submitChange(
    documentId: string,
    change: Omit<EncryptedChangeEnvelope, "seq">,
  ): Promise<EncryptedChangeEnvelope> {
    const response = await this.request({
      type: "SubmitChangeRequest",
      docId: documentId,
      change,
    });

    const accepted = this.expectResponse(response, "ChangeAccepted");
    const seq = accepted.assignedSeq;
    this.updateLastSeq(documentId, seq);

    return { ...change, documentId, seq };
  }

  async fetchChangesSince(
    documentId: string,
    sinceSeq: number,
  ): Promise<readonly EncryptedChangeEnvelope[]> {
    const response = await this.request({
      type: "FetchChangesRequest",
      docId: documentId,
      sinceSeq,
    });

    const changesResp = this.expectResponse(response, "ChangesResponse");
    const last = changesResp.changes[changesResp.changes.length - 1];
    if (last) this.updateLastSeq(documentId, last.seq);

    return changesResp.changes;
  }

  async submitSnapshot(documentId: string, snapshot: EncryptedSnapshotEnvelope): Promise<void> {
    const response = await this.request({
      type: "SubmitSnapshotRequest",
      docId: documentId,
      snapshot,
    });

    if (response.type === "SyncError") {
      // Server already has a newer version — not an error for the submitter
      if (response.code === "VERSION_CONFLICT") return;
      throw new SyncProtocolError(response.code, response.message, response.docId);
    }
    if (response.type !== "SnapshotAccepted") {
      throw new UnexpectedResponseError("SnapshotAccepted", response.type);
    }
  }

  async fetchLatestSnapshot(documentId: string): Promise<EncryptedSnapshotEnvelope | null> {
    const response = await this.request({
      type: "FetchSnapshotRequest",
      docId: documentId,
    });

    const snapshotResp = this.expectResponse(response, "SnapshotResponse");
    return snapshotResp.snapshot;
  }

  subscribe(
    documentId: string,
    onChanges: (changes: readonly EncryptedChangeEnvelope[]) => void,
  ): SyncSubscription {
    let callbacks = this.subscriptions.get(documentId);
    if (!callbacks) {
      callbacks = new Set();
      this.subscriptions.set(documentId, callbacks);
    }
    callbacks.add(onChanges);

    // Send SubscribeRequest (fire-and-forget for subscribe)
    const lastSeq = this.lastSeqPerDoc.get(documentId) ?? 0;
    void this.transport
      .send({
        type: "SubscribeRequest",
        correlationId: crypto.randomUUID(),
        documents: [{ docId: documentId, lastSyncedSeq: lastSeq, lastSnapshotVersion: 0 }],
      })
      .catch((err: unknown) => {
        this.logger?.warn("Subscribe transport send failed", { error: String(err) });
        callbacks.delete(onChanges);
        if (callbacks.size === 0) this.subscriptions.delete(documentId);
      });

    return {
      unsubscribe: () => {
        callbacks.delete(onChanges);
        if (callbacks.size === 0) {
          this.subscriptions.delete(documentId);
          void this.transport
            .send({
              type: "UnsubscribeRequest",
              correlationId: crypto.randomUUID(),
              docId: documentId,
            })
            .catch((err: unknown) => {
              this.logger?.warn("Unsubscribe send failed", {
                docId: documentId,
                error: String(err),
              });
            });
        }
      },
    };
  }

  async fetchManifest(systemId: string): Promise<SyncManifest> {
    const response = await this.request({
      type: "ManifestRequest",
      systemId,
    });

    const manifestResp = this.expectResponse(response, "ManifestResponse");
    return manifestResp.manifest;
  }

  /** Whether this adapter has been disposed. */
  get isDisposed(): boolean {
    return this.disposed;
  }

  private expectResponse<T extends ServerMessage["type"]>(
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

  private handleMessage(msg: ServerMessage): void {
    // M12: Guard against calls after dispose
    if (this.disposed) return;

    // Server-pushed DocumentUpdate — dispatch to subscribers
    if (msg.type === "DocumentUpdate") {
      const callbacks = this.subscriptions.get(msg.docId);
      if (callbacks) {
        for (const cb of callbacks) {
          try {
            cb(msg.changes);
          } catch (err) {
            this.logger?.warn("Subscriber callback error", { error: String(err) });
          }
        }
      }
      const lastPushed = msg.changes[msg.changes.length - 1];
      if (lastPushed) this.updateLastSeq(msg.docId, lastPushed.seq);
      return;
    }

    // Correlated response — resolve pending request
    if (msg.correlationId) {
      const pending = this.pending.get(msg.correlationId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(msg.correlationId);
        pending.resolve(msg);
      }
    }
  }

  private request(
    message: DistributiveOmit<ClientMessage, "correlationId">,
  ): Promise<ServerMessage> {
    if (this.disposed) {
      return Promise.reject(new AdapterDisposedError());
    }

    const correlationId = crypto.randomUUID();
    const fullMessage = { ...message, correlationId } as ClientMessage;

    return new Promise<ServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(new SyncTimeoutError(message.type));
      }, this.timeoutMs);

      this.pending.set(correlationId, {
        resolve,
        reject,
        timer,
      });

      void this.transport.send(fullMessage).catch((err: unknown) => {
        clearTimeout(timer);
        this.pending.delete(correlationId);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  close(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new AdapterDisposedError());
    }
    this.pending.clear();
    this.subscriptions.clear();
    this.lastSeqPerDoc.clear();
  }

  private updateLastSeq(documentId: string, seq: number): void {
    const current = this.lastSeqPerDoc.get(documentId) ?? 0;
    if (seq > current) {
      this.lastSeqPerDoc.set(documentId, seq);
    }
  }
}
