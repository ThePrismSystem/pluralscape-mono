/**
 * In-memory SyncTransport wired to an EncryptedRelay.
 * Used by WsNetworkAdapter contract tests to avoid real WebSocket connections.
 */
import { EncryptedRelay } from "../relay.js";

import type { ClientMessage, ServerMessage, SyncTransport, TransportState } from "../protocol.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "../types.js";
import type { SystemId } from "@pluralscape/types";

export class MockSyncTransport implements SyncTransport {
  state: TransportState = "connected";
  private handler: ((msg: ServerMessage) => void) | null = null;
  private readonly relay: EncryptedRelay;
  private readonly subscriptions = new Map<string, boolean>();

  constructor(relay?: EncryptedRelay) {
    this.relay = relay ?? new EncryptedRelay();
  }

  send(message: ClientMessage): Promise<void> {
    if (this.state !== "connected") {
      return Promise.reject(new Error("Transport not connected"));
    }
    // Process message and generate response
    const response = this.processMessage(message);
    if (response) {
      // Deliver response asynchronously (simulates network)
      void Promise.resolve().then(() => {
        if (Array.isArray(response)) {
          for (const msg of response) {
            this.handler?.(msg);
          }
        } else {
          this.handler?.(response);
        }
      });
    }
    return Promise.resolve();
  }

  onMessage(handler: (msg: ServerMessage) => void): void {
    this.handler = handler;
  }

  close(): void {
    this.state = "disconnected";
  }

  /** Expose relay for test setup (pre-populating data). */
  getRelay(): EncryptedRelay {
    return this.relay;
  }

  private processMessage(message: ClientMessage): ServerMessage | ServerMessage[] | null {
    switch (message.type) {
      case "AuthenticateRequest":
        return {
          type: "AuthenticateResponse",
          correlationId: message.correlationId,
          syncSessionId: `sess_${crypto.randomUUID()}`,
          serverTime: Date.now(),
        };

      case "ManifestRequest":
        return {
          type: "ManifestResponse",
          correlationId: message.correlationId,
          manifest: { systemId: message.systemId as SystemId, documents: [] },
        };

      case "SubscribeRequest":
        for (const entry of message.documents) {
          this.subscriptions.set(entry.docId, true);
        }
        return {
          type: "SubscribeResponse",
          correlationId: message.correlationId,
          catchup: message.documents.map((entry) => ({
            docId: entry.docId,
            changes: this.relay.getEnvelopesSince(entry.docId, entry.lastSyncedSeq),
            snapshot: null,
          })),
        };

      case "UnsubscribeRequest":
        this.subscriptions.delete(message.docId);
        return null;

      case "FetchSnapshotRequest":
        return {
          type: "SnapshotResponse",
          correlationId: message.correlationId,
          docId: message.docId,
          snapshot: this.relay.getLatestSnapshot(message.docId),
        };

      case "FetchChangesRequest":
        return {
          type: "ChangesResponse",
          correlationId: message.correlationId,
          docId: message.docId,
          changes: this.relay.getEnvelopesSince(message.docId, message.sinceSeq),
        };

      case "SubmitChangeRequest": {
        const seq = this.relay.submit({
          ...message.change,
          documentId: message.docId,
        });
        const accepted: ServerMessage = {
          type: "ChangeAccepted",
          correlationId: message.correlationId,
          docId: message.docId,
          assignedSeq: seq,
        };
        // Also push DocumentUpdate to subscribers
        const sequenced: EncryptedChangeEnvelope = {
          ...message.change,
          documentId: message.docId,
          seq,
        };
        if (this.subscriptions.has(message.docId)) {
          return [
            accepted,
            {
              type: "DocumentUpdate",
              correlationId: null,
              docId: message.docId,
              changes: [sequenced],
            },
          ];
        }
        return accepted;
      }

      case "SubmitSnapshotRequest": {
        try {
          const snapshot: EncryptedSnapshotEnvelope = {
            ...message.snapshot,
            documentId: message.docId,
          };
          this.relay.submitSnapshot(snapshot);
          return {
            type: "SnapshotAccepted",
            correlationId: message.correlationId,
            docId: message.docId,
            snapshotVersion: message.snapshot.snapshotVersion,
          };
        } catch {
          return {
            type: "SyncError",
            correlationId: message.correlationId,
            code: "VERSION_CONFLICT",
            message: "Snapshot version conflict",
            docId: message.docId,
          };
        }
      }

      case "DocumentLoadRequest":
        return [
          {
            type: "SnapshotResponse",
            correlationId: message.correlationId,
            docId: message.docId,
            snapshot: this.relay.getLatestSnapshot(message.docId),
          },
          {
            type: "ChangesResponse",
            correlationId: message.correlationId,
            docId: message.docId,
            changes: this.relay.getEnvelopesSince(message.docId, 0),
          },
        ];

      default:
        return null;
    }
  }
}
