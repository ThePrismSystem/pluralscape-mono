/**
 * WebSocket client fixture for E2E tests.
 *
 * Wraps the native WebSocket API with typed send/receive for the
 * sync protocol. Uses Node 22+ native WebSocket (no external dependency).
 */
import { SYNC_PROTOCOL_VERSION } from "@pluralscape/sync";

import type { ClientMessage, ServerMessage } from "@pluralscape/sync";
import type { SyncDocumentId, SystemId } from "@pluralscape/types";

const E2E_PORT = 10_099;
const WS_URL = `ws://localhost:${String(E2E_PORT)}/v1/sync/ws`;
const DEFAULT_TIMEOUT_MS = 5_000;

/** Generate a base64url string that decodes to exactly `n` bytes of the given fill value. */
export function base64urlOfLength(n: number, fill = 0): string {
  return Buffer.from(new Uint8Array(n).fill(fill)).toString("base64url");
}

/** Wire-format change payload with base64url-encoded binary fields. */
export interface WireChangePayload {
  ciphertext: string;
  nonce: string;
  signature: string;
  authorPublicKey: string;
  documentId: string;
}

/** Thin wrapper around WebSocket with typed sync protocol methods. */
export class SyncWsClient {
  private ws: WebSocket | null = null;
  private readonly messageQueue: ServerMessage[] = [];
  private readonly waiters: Array<{
    resolve: (msg: ServerMessage) => void;
    reject: (err: Error) => void;
    type: string | null;
  }> = [];

  /** Open a WebSocket connection. */
  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      this.ws = ws;

      ws.addEventListener("open", () => {
        resolve();
      });

      ws.addEventListener("error", () => {
        reject(new Error("WebSocket connection error"));
      });

      ws.addEventListener("message", (evt) => {
        const msg = JSON.parse(String(evt.data)) as ServerMessage;

        // Check if anyone is waiting for this message type
        const waiterIndex = this.waiters.findIndex((w) => w.type === null || w.type === msg.type);
        if (waiterIndex >= 0) {
          const waiter = this.waiters[waiterIndex];
          this.waiters.splice(waiterIndex, 1);
          waiter?.resolve(msg);
        } else {
          this.messageQueue.push(msg);
        }
      });
    });
  }

  /** Send a ClientMessage. */
  send(msg: ClientMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
    this.ws.send(JSON.stringify(msg));
  }

  /** Wait for a message of a specific type (or any message if type is null). */
  async waitForMessage(
    type: string | null = null,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<ServerMessage> {
    // Check queue first
    const queueIndex = this.messageQueue.findIndex((m) => type === null || m.type === type);
    if (queueIndex >= 0) {
      const msg = this.messageQueue[queueIndex];
      this.messageQueue.splice(queueIndex, 1);
      if (msg) return msg;
    }

    return new Promise<ServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) {
          this.waiters.splice(idx, 1);
        }
        reject(new Error(`Timeout waiting for message type="${type ?? "any"}"`));
      }, timeoutMs);

      this.waiters.push({
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        type,
      });
    });
  }

  /** Send AuthenticateRequest and wait for response. */
  async authenticate(sessionToken: string, systemId: string): Promise<ServerMessage> {
    this.send({
      type: "AuthenticateRequest",
      correlationId: null,
      protocolVersion: SYNC_PROTOCOL_VERSION,
      sessionToken,
      systemId: systemId as SystemId,
      profileType: "owner-full",
    });
    return this.waitForMessage(null);
  }

  /** Send SubscribeRequest and wait for SubscribeResponse. */
  async subscribe(
    documents: Array<{ docId: string; lastSyncedSeq: number; lastSnapshotVersion: number }>,
  ): Promise<ServerMessage> {
    this.send({
      type: "SubscribeRequest",
      correlationId: null,
      documents: documents.map((d) => ({ ...d, docId: d.docId as SyncDocumentId })),
    });
    return this.waitForMessage("SubscribeResponse");
  }

  /** Send SubmitChangeRequest (wire format with base64url strings) and wait for response. */
  async submitChange(docId: string, change: WireChangePayload): Promise<ServerMessage> {
    // Send raw JSON — wire format uses base64url strings, not Uint8Array
    this.sendRaw(
      JSON.stringify({
        type: "SubmitChangeRequest",
        correlationId: null,
        docId,
        change,
      }),
    );
    return this.waitForMessage(null);
  }

  /** Send SubmitSnapshotRequest (wire format with base64url strings) and wait for response. */
  async submitSnapshot(
    docId: string,
    snapshot: {
      ciphertext: string;
      nonce: string;
      signature: string;
      authorPublicKey: string;
      documentId: string;
      snapshotVersion: number;
    },
  ): Promise<ServerMessage> {
    this.sendRaw(
      JSON.stringify({
        type: "SubmitSnapshotRequest",
        correlationId: null,
        docId,
        snapshot,
      }),
    );
    return this.waitForMessage(null);
  }

  /** Send a raw string over the WebSocket. */
  sendRaw(data: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
    this.ws.send(data);
  }

  /** Close the connection. */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageQueue.length = 0;
    const pendingWaiters = [...this.waiters];
    this.waiters.length = 0;
    for (const w of pendingWaiters) {
      w.reject(new Error("WebSocket closed"));
    }
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}
