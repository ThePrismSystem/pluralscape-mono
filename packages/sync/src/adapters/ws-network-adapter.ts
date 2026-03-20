declare function setTimeout(fn: () => void, ms: number): number;
declare function clearTimeout(id: number): void;

import type { ClientMessage, ServerMessage, SyncTransport } from "../protocol.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { SyncManifest, SyncNetworkAdapter, SyncSubscription } from "./network-adapter.js";

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
 */
export class WsNetworkAdapter implements SyncNetworkAdapter {
  private readonly transport: SyncTransport;
  private readonly pending = new Map<string, PendingRequest<ServerMessage>>();
  private readonly subscriptions = new Map<
    string,
    Set<(changes: readonly EncryptedChangeEnvelope[]) => void>
  >();
  private readonly timeoutMs: number;
  private readonly onError: ((message: string, error: unknown) => void) | undefined;

  constructor(
    transport: SyncTransport,
    timeoutMs = REQUEST_TIMEOUT_MS,
    onError?: (message: string, error: unknown) => void,
  ) {
    this.transport = transport;
    this.timeoutMs = timeoutMs;
    this.onError = onError;

    transport.onMessage((msg) => {
      this.handleMessage(msg);
    });

    transport.onClose?.(() => {
      this.rejectAllPending(new Error("Transport closed"));
    });

    transport.onError?.((error) => {
      this.rejectAllPending(error);
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

    if (response.type === "SyncError") {
      throw new Error(`SyncError [${response.code}]: ${response.message}`);
    }

    if (response.type !== "ChangeAccepted") {
      throw new Error(`Unexpected response: ${response.type}`);
    }

    const seq = response.assignedSeq;

    return { ...change, documentId, seq };
  }

  async fetchChangesSince(
    documentId: string,
    sinceSeq: number,
    limit?: number,
  ): Promise<readonly EncryptedChangeEnvelope[]> {
    const response = await this.request({
      type: "FetchChangesRequest",
      docId: documentId,
      sinceSeq,
      limit,
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
    const response = await this.request({
      type: "SubmitSnapshotRequest",
      docId: documentId,
      snapshot,
    });

    if (response.type === "SyncError" && response.code === "VERSION_CONFLICT") {
      // Server already has a newer version — this is not an error condition
      // for the submitter since the goal (having a snapshot) is met.
      if (this.onError) {
        this.onError("Snapshot VERSION_CONFLICT (non-fatal, server has newer)", undefined);
      }
      return;
    }
    if (response.type !== "SnapshotAccepted") {
      throw new Error(`Unexpected response: ${response.type}`);
    }
  }

  async fetchLatestSnapshot(documentId: string): Promise<EncryptedSnapshotEnvelope | null> {
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
    lastSyncedSeq?: number,
  ): SyncSubscription {
    let callbacks = this.subscriptions.get(documentId);
    if (!callbacks) {
      callbacks = new Set();
      this.subscriptions.set(documentId, callbacks);
    }
    callbacks.add(onChanges);

    // Send SubscribeRequest and consume catch-up
    const correlationId = crypto.randomUUID();
    this.request<ServerMessage>({
      type: "SubscribeRequest",
      correlationId,
      documents: [{ docId: documentId, lastSyncedSeq: lastSyncedSeq ?? 0, lastSnapshotVersion: 0 }],
    }).then((response) => {
      if (response.type === "SubscribeResponse") {
        for (const catchup of response.catchup) {
          if (catchup.changes.length > 0) {
            const cbs = this.subscriptions.get(catchup.docId);
            if (cbs) {
              for (const cb of cbs) {
                try {
                  cb(catchup.changes);
                } catch (e) {
                  this.onError?.("Subscriber callback error", e);
                }
              }
            }
          }
        }
      }
    }).catch((err: unknown) => {
      this.onError?.("Subscribe catch-up failed", err);
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
            .catch(() => {
              /* unsubscribe send failure is non-critical */
            });
        }
      },
    };
  }

  close(): void {
    this.rejectAllPending(new Error("Adapter closed"));
    this.transport.close();
  }

  async fetchManifest(systemId: string): Promise<SyncManifest> {
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

  private handleMessage(msg: ServerMessage): void {
    // Server-pushed DocumentUpdate — dispatch to subscribers
    if (msg.type === "DocumentUpdate") {
      const callbacks = this.subscriptions.get(msg.docId);
      if (callbacks) {
        for (const cb of callbacks) {
          try {
            cb(msg.changes);
          } catch (e) {
            this.onError?.("DocumentUpdate callback error", e);
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
    const correlationId = crypto.randomUUID();
    const fullMessage = { ...message, correlationId } as ClientMessage;

    return new Promise<ServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
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

  private rejectAllPending(error: Error): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
