import type { ClientMessage, ServerMessage, SyncTransport } from "../protocol.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { SyncManifest, SyncNetworkAdapter, SyncSubscription } from "./network-adapter.js";

/** Distributive Omit that preserves union members. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Default timeout for request/response pairs (ms). */
const REQUEST_TIMEOUT_MS = 30_000;

interface PendingRequest {
  resolve: (value: ServerMessage) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * WebSocket-backed SyncNetworkAdapter.
 *
 * Maps adapter methods to client/server message pairs using correlation IDs.
 * Supports subscriptions with real-time DocumentUpdate pushes.
 */
export class WsNetworkAdapter implements SyncNetworkAdapter {
  private readonly transport: SyncTransport;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly subscriptions = new Map<
    string,
    Set<(changes: readonly EncryptedChangeEnvelope[]) => void>
  >();
  private readonly lastSeqPerDoc = new Map<string, number>();
  private readonly timeoutMs: number;
  private disposed = false;

  constructor(transport: SyncTransport, timeoutMs = REQUEST_TIMEOUT_MS) {
    this.transport = transport;
    this.timeoutMs = timeoutMs;

    transport.onMessage((msg) => {
      this.handleMessage(msg);
    });
  }

  async submitChange(
    documentId: string,
    change: Omit<EncryptedChangeEnvelope, "seq">,
  ): Promise<EncryptedChangeEnvelope> {
    const correlationId = crypto.randomUUID();
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
    const correlationId = crypto.randomUUID();
    const response = await this.request({
      type: "FetchChangesRequest",
      docId: documentId,
      sinceSeq,
    });

    if (response.type === "SyncError") {
      throw new Error(`SyncError [${response.code}]: ${response.message}`);
    }

    if (response.type !== "ChangesResponse") {
      throw new Error(`Unexpected response: ${response.type}`);
    }

    return changesResp.changes;
  }

  async submitSnapshot(documentId: string, snapshot: EncryptedSnapshotEnvelope): Promise<void> {
    const correlationId = crypto.randomUUID();
    const response = await this.request({
      type: "SubmitSnapshotRequest",
      docId: documentId,
      snapshot,
    });

    if (response.type === "SyncError") {
      if (response.code === "VERSION_CONFLICT") return;
      throw new Error(`SyncError: ${response.message}`);
    }
    if (response.type !== "SnapshotAccepted") {
      throw new Error(`Unexpected response: ${response.type}`);
    }
  }

  async fetchLatestSnapshot(documentId: string): Promise<EncryptedSnapshotEnvelope | null> {
    const correlationId = crypto.randomUUID();
    const response = await this.request({
      type: "FetchSnapshotRequest",
      docId: documentId,
    });

    if (response.type === "SyncError") {
      throw new Error(`SyncError [${response.code}]: ${response.message}`);
    }

    if (response.type !== "SnapshotResponse") {
      throw new Error(`Unexpected response: ${response.type}`);
    }

    return response.snapshot;
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

    // Send SubscribeRequest and handle catch-up from response
    const lastSeq = this.lastSeqPerDoc.get(documentId) ?? 0;
    void this.request({
      type: "SubscribeRequest",
      correlationId: crypto.randomUUID(),
      documents: [{ docId: documentId, lastSyncedSeq: lastSeq, lastSnapshotVersion: 0 }],
    })
      .then((resp) => {
        if (resp.type === "SyncError") {
          console.warn(
            `[WsNetworkAdapter] subscribe failed for ${documentId}: [${resp.code}] ${resp.message}`,
          );
          callbacks.delete(onChanges);
          if (callbacks.size === 0) {
            this.subscriptions.delete(documentId);
          }
          return;
        }
        if (resp.type === "SubscribeResponse") {
          for (const entry of resp.catchup) {
            if (entry.docId === documentId && entry.changes.length > 0) {
              const cbs = this.subscriptions.get(documentId);
              if (cbs) {
                for (const cb of cbs) {
                  try {
                    cb(entry.changes);
                  } catch {
                    /* subscriber error is non-fatal */
                  }
                }
              }
            }
          }
        }
      })
      .catch((error: unknown) => {
        console.warn(`[WsNetworkAdapter] subscribe transport error for ${documentId}`, error);
      });

    return {
      unsubscribe: () => {
        callbacks.delete(onChanges);
        if (callbacks.size === 0) {
          this.subscriptions.delete(documentId);
          if (!this.disposed) {
            void this.transport.send({
              type: "UnsubscribeRequest",
              correlationId: crypto.randomUUID(),
              docId: documentId,
            });
          }
        }
      },
    };
  }

  async fetchManifest(systemId: string): Promise<SyncManifest> {
    const correlationId = crypto.randomUUID();
    const response = await this.request({
      type: "ManifestRequest",
      systemId,
    });

    if (response.type === "SyncError") {
      throw new Error(`SyncError [${response.code}]: ${response.message}`);
    }

    if (response.type !== "ManifestResponse") {
      throw new Error(`Unexpected response: ${response.type}`);
    }
    return response as Extract<ServerMessage, { type: T }>;
  }

  /** Dispose the adapter, clearing all pending requests and subscriptions. */
  dispose(): void {
    this.disposed = true;
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Adapter disposed"));
      this.pending.delete(id);
    }
    this.subscriptions.clear();
  }

  private handleMessage(msg: ServerMessage): void {
    // Server-pushed DocumentUpdate — dispatch to subscribers
    if (msg.type === "DocumentUpdate") {
      const callbacks = this.subscriptions.get(msg.docId);
      if (callbacks) {
        for (const cb of callbacks) {
          try {
            cb(msg.changes);
          } catch {
            /* subscriber error is non-fatal */
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

  private request(message: ClientMessage): Promise<ServerMessage> {
    const correlationId = message.correlationId;

    if (this.disposed || !correlationId) {
      return Promise.reject(
        new Error(this.disposed ? "Adapter disposed" : "Missing correlationId"),
      );
    }

    return new Promise<ServerMessage>((resolve, reject) => {
      const timer = globalThis.setTimeout(() => {
        this.pending.delete(correlationId);
        reject(new Error(`Request timed out: ${message.type}`));
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

  dispose(): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Adapter disposed"));
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
