import { describe, expect, it, vi } from "vitest";

import { WsNetworkAdapter } from "../adapters/ws-network-adapter.js";

import { MockSyncTransport } from "./mock-sync-transport.js";
import { runNetworkAdapterContract } from "./network-adapter.contract.js";
import { nonce, pubkey, sig } from "./test-crypto-helpers.js";

import type { ServerMessage, SyncTransport, TransportState } from "../protocol.js";
import type { EncryptedChangeEnvelope } from "../types.js";

import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";
import type { EncryptedChangeEnvelope, ServerMessage, SyncTransport } from "@pluralscape/sync";

function nonce(fill: number): AeadNonce {
  const bytes: unknown = new Uint8Array(24).fill(fill);
  return bytes as AeadNonce;
}
function pubkey(fill: number): SignPublicKey {
  const bytes: unknown = new Uint8Array(32).fill(fill);
  return bytes as SignPublicKey;
}
function sig(fill: number): Signature {
  const bytes: unknown = new Uint8Array(64).fill(fill);
  return bytes as Signature;
}

function mockChangeWithoutSeq(docId: string): Omit<EncryptedChangeEnvelope, "seq"> {
  return {
    ciphertext: new Uint8Array([1, 2, 3]),
    nonce: nonce(0xaa),
    signature: sig(0xbb),
    authorPublicKey: pubkey(0xcc),
    documentId: docId,
  };
}

describe("WsNetworkAdapter", () => {
  function createAdapter(): WsNetworkAdapter {
    const transport = new MockSyncTransport();
    return new WsNetworkAdapter(transport);
  }

  runNetworkAdapterContract(createAdapter);

  describe("timeout", () => {
    it("rejects pending request after timeout", async () => {
      // Transport that never delivers a response
      const silentTransport: SyncTransport = {
        state: "connected" as TransportState,
        send: vi.fn().mockResolvedValue(undefined),
        onMessage: vi.fn(),
        close: vi.fn(),
      };
      const adapter = new WsNetworkAdapter(silentTransport, 50);

      await expect(adapter.fetchManifest("sys_test")).rejects.toThrow("timed out");
    });
  });

  describe("SyncError responses", () => {
    function makeSyncErrorTransport(code: string, message: string): SyncTransport {
      let handler: ((msg: ServerMessage) => void) | null = null;
      return {
        state: "connected" as TransportState,
        send: vi.fn().mockImplementation((msg: { correlationId: string | null }) => {
          void Promise.resolve().then(() => {
            handler?.({
              type: "SyncError",
              correlationId: msg.correlationId,
              code,
              message,
              docId: null,
            } as ServerMessage);
          });
          return Promise.resolve();
        }),
        onMessage: (h: (msg: ServerMessage) => void) => {
          handler = h;
        },
        close: vi.fn(),
      };
    }

    it("fetchChangesSince throws on SyncError", async () => {
      const transport = makeSyncErrorTransport("PERMISSION_DENIED", "Access denied");
      const adapter = new WsNetworkAdapter(transport);
      await expect(adapter.fetchChangesSince("doc_1", 0)).rejects.toThrow("SyncError");
    });

    it("fetchLatestSnapshot throws on SyncError", async () => {
      const transport = makeSyncErrorTransport("DOCUMENT_NOT_FOUND", "Not found");
      const adapter = new WsNetworkAdapter(transport);
      await expect(adapter.fetchLatestSnapshot("doc_1")).rejects.toThrow("SyncError");
    });

    it("fetchManifest throws on SyncError", async () => {
      const transport = makeSyncErrorTransport("AUTH_FAILED", "Bad token");
      const adapter = new WsNetworkAdapter(transport);
      await expect(adapter.fetchManifest("sys_1")).rejects.toThrow("SyncError");
    });
  });

  describe("subscriber isolation", () => {
    it("throwing callback does not kill other subscribers", async () => {
      const transport = new MockSyncTransport();
      const adapter = new WsNetworkAdapter(transport);

      const docId = "doc_isolation";
      const received: EncryptedChangeEnvelope[][] = [];

      adapter.subscribe(docId, () => {
        throw new Error("Bad subscriber");
      });
      adapter.subscribe(docId, (changes) => {
        received.push([...changes]);
      });

      // Submit a change — triggers DocumentUpdate to both subscribers
      await adapter.submitChange(docId, {
        documentId: docId,
        ciphertext: new Uint8Array([1]),
        nonce: nonce(1),
        signature: sig(1),
        authorPublicKey: pubkey(1),
      });

      // Give async delivery a chance
      await new Promise((r) => {
        setTimeout(r, 50);
      });

      expect(received.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("multi-subscriber lifecycle", () => {
    it("multiple subscribers receive updates, unsubscribe independently", async () => {
      const transport = new MockSyncTransport();
      const adapter = new WsNetworkAdapter(transport);

      const docId = "doc_multi";
      const received1: number[] = [];
      const received2: number[] = [];

      const sub1 = adapter.subscribe(docId, (changes) => {
        received1.push(changes.length);
      });
      const sub2 = adapter.subscribe(docId, (changes) => {
        received2.push(changes.length);
      });

      await adapter.submitChange(docId, {
        documentId: docId,
        ciphertext: new Uint8Array([1]),
        nonce: nonce(10),
        signature: sig(10),
        authorPublicKey: pubkey(10),
      });

      await new Promise((r) => {
        setTimeout(r, 50);
      });

      sub1.unsubscribe();

      await adapter.submitChange(docId, {
        documentId: docId,
        ciphertext: new Uint8Array([2]),
        nonce: nonce(11),
        signature: sig(11),
        authorPublicKey: pubkey(11),
      });

      await new Promise((r) => {
        setTimeout(r, 50);
      });

      // sub1 should have received from first change only (plus possible catchup)
      // sub2 should have received from both
      expect(received2.length).toBeGreaterThan(received1.length);

      sub2.unsubscribe();
    });
  });

  describe("close", () => {
    it("rejects pending requests and closes transport", () => {
      const transport = new MockSyncTransport();
      const adapter = new WsNetworkAdapter(transport);

      adapter.close();

      expect(transport.state).toBe("disconnected");
    });

    it("rejects in-flight requests on close", async () => {
      const silentTransport: SyncTransport = {
        state: "connected" as TransportState,
        send: vi.fn().mockResolvedValue(undefined),
        onMessage: vi.fn(),
        close: vi.fn(),
      };
      const adapter = new WsNetworkAdapter(silentTransport, 5000);

      const promise = adapter.fetchManifest("sys_test");
      adapter.close();

      await expect(promise).rejects.toThrow("Adapter closed");
    });
  });

  describe("onError callback", () => {
    it("reports DocumentUpdate callback errors via onError", async () => {
      const transport = new MockSyncTransport();
      const onError = vi.fn();
      const adapter = new WsNetworkAdapter(transport, undefined, onError);

      const docId = "doc_error";
      const callbackError = new Error("Bad subscriber");

      adapter.subscribe(docId, () => {
        throw callbackError;
      });

      await adapter.submitChange(docId, {
        documentId: docId,
        ciphertext: new Uint8Array([1]),
        nonce: nonce(1),
        signature: sig(1),
        authorPublicKey: pubkey(1),
      });

      await new Promise((r) => {
        setTimeout(r, 50);
      });

      expect(onError).toHaveBeenCalledWith("DocumentUpdate callback error", callbackError);
    });

    it("reports VERSION_CONFLICT via onError", async () => {
      const transport = new MockSyncTransport();
      const onError = vi.fn();
      const adapter = new WsNetworkAdapter(transport, undefined, onError);

      const docId = "doc_snap";

      // First snapshot succeeds
      await adapter.submitSnapshot(docId, {
        documentId: docId,
        ciphertext: new Uint8Array([1]),
        nonce: nonce(1),
        signature: sig(1),
        authorPublicKey: pubkey(1),
        snapshotVersion: 2,
      });

      // Second with same version triggers VERSION_CONFLICT
      await adapter.submitSnapshot(docId, {
        documentId: docId,
        ciphertext: new Uint8Array([2]),
        nonce: nonce(2),
        signature: sig(2),
        authorPublicKey: pubkey(2),
        snapshotVersion: 1,
      });

      expect(onError).toHaveBeenCalledWith(
        "Snapshot VERSION_CONFLICT (non-fatal, server has newer)",
        undefined,
      );
    });
  });

  describe("transport disconnect", () => {
    it("close rejects all pending requests", async () => {
      const silentTransport: SyncTransport = {
        state: "connected" as TransportState,
        send: vi.fn().mockResolvedValue(undefined),
        onMessage: vi.fn(),
        close: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
      };
      const adapter2 = new WsNetworkAdapter(silentTransport, 5000);

      // Capture the onClose handler
      const onCloseCalls = (silentTransport.onClose as ReturnType<typeof vi.fn>).mock.calls;
      const closeHandler = onCloseCalls[0]?.[0] as ((reason?: string) => void) | undefined;

      const promise = adapter2.fetchManifest("sys_test");

      // Simulate transport close
      closeHandler?.("test disconnect");

      await expect(promise).rejects.toThrow("Transport closed");
    });
  });
});
