declare function setTimeout(fn: () => void, ms: number): number;
declare function clearTimeout(id: number): void;

import type { ClientMessage, ServerMessage, SyncTransport } from "../protocol.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { SyncManifest, SyncNetworkAdapter, SyncSubscription } from "./network-adapter.js";

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
    const response = await this.request<ServerMessage>({
      type: "SubmitChangeRequest",
      correlationId,
      docId: documentId,
      change,
    });

    if (response.type === "SyncError") {
      throw new Error(`SyncError: ${response.message}`);
    }

    if (response.type !== "ChangeAccepted") {
      throw new Error(`Unexpected response: ${response.type}`);
    }

    const seq = response.assignedSeq;
    this.updateLastSeq(documentId, seq);

    return { ...change, documentId, seq };
  }

  async fetchChangesSince(
    documentId: string,
    sinceSeq: number,
  ): Promise<readonly EncryptedChangeEnvelope[]> {
    const correlationId = crypto.randomUUID();
    const response = await this.request<ServerMessage>({
      type: "FetchChangesRequest",
      correlationId,
      docId: documentId,
      sinceSeq,
    });

    if (response.type !== "ChangesResponse") {
      throw new Error(`Unexpected response: ${response.type}`);
    }

    return response.changes;
  }

  async submitSnapshot(documentId: string, snapshot: EncryptedSnapshotEnvelope): Promise<void> {
    const correlationId = crypto.randomUUID();
    const response = await this.request<ServerMessage>({
      type: "SubmitSnapshotRequest",
      correlationId,
      docId: documentId,
      snapshot,
    });

    if (response.type === "SyncError" && response.code === "VERSION_CONFLICT") {
      // Server already has a newer version — this is not an error condition
      // for the submitter since the goal (having a snapshot) is met.
      return;
    }

    if (response.type !== "SnapshotAccepted") {
      throw new Error(`Unexpected response: ${response.type}`);
    }
  }

  async fetchLatestSnapshot(documentId: string): Promise<EncryptedSnapshotEnvelope | null> {
    const correlationId = crypto.randomUUID();
    const response = await this.request<ServerMessage>({
      type: "FetchSnapshotRequest",
      correlationId,
      docId: documentId,
    });

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

    // Send SubscribeRequest (fire-and-forget for subscribe)
    const lastSeq = this.lastSeqPerDoc.get(documentId) ?? 0;
    void this.transport.send({
      type: "SubscribeRequest",
      correlationId: crypto.randomUUID(),
      documents: [{ docId: documentId, lastSyncedSeq: lastSeq, lastSnapshotVersion: 0 }],
    });

    return {
      unsubscribe: () => {
        callbacks.delete(onChanges);
        if (callbacks.size === 0) {
          this.subscriptions.delete(documentId);
          void this.transport.send({
            type: "UnsubscribeRequest",
            correlationId: crypto.randomUUID(),
            docId: documentId,
          });
        }
      },
    };
  }

  async fetchManifest(systemId: string): Promise<SyncManifest> {
    const correlationId = crypto.randomUUID();
    const response = await this.request<ServerMessage>({
      type: "ManifestRequest",
      correlationId,
      systemId,
    });

    if (response.type !== "ManifestResponse") {
      throw new Error(`Unexpected response: ${response.type}`);
    }

    return response.manifest;
  }

  private handleMessage(msg: ServerMessage): void {
    // Server-pushed DocumentUpdate — dispatch to subscribers
    if (msg.type === "DocumentUpdate") {
      const callbacks = this.subscriptions.get(msg.docId);
      if (callbacks) {
        for (const cb of callbacks) {
          cb(msg.changes);
        }
      }
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

  private request<T extends ServerMessage>(message: ClientMessage): Promise<T> {
    const correlationId = message.correlationId;
    if (!correlationId) {
      return Promise.reject(new Error("Message must have a correlationId"));
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(new Error(`Request timed out: ${message.type}`));
      }, this.timeoutMs);

      this.pending.set(correlationId, {
        resolve: resolve as (value: ServerMessage) => void,
        reject,
        timer,
      });

      void this.transport.send(message).catch((err: unknown) => {
        clearTimeout(timer);
        this.pending.delete(correlationId);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  private updateLastSeq(documentId: string, seq: number): void {
    const current = this.lastSeqPerDoc.get(documentId) ?? 0;
    if (seq > current) {
      this.lastSeqPerDoc.set(documentId, seq);
    }
  }
}
