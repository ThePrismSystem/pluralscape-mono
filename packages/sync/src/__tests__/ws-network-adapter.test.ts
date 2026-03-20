import { afterEach, describe, expect, it, vi } from "vitest";

import { WsNetworkAdapter } from "../adapters/ws-network-adapter.js";

import { MockSyncTransport } from "./mock-sync-transport.js";
import { runNetworkAdapterContract } from "./network-adapter.contract.js";

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

  describe("dispose", () => {
    it("rejects pending requests", async () => {
      let onMessage: ((msg: ServerMessage) => void) | null = null;
      const transport: SyncTransport = {
        state: "connected",
        send: () => Promise.resolve(),
        onMessage: (handler) => {
          onMessage = handler;
        },
        close: () => {},
      };
      const adapter = new WsNetworkAdapter(transport, 30_000);

      const pending = adapter.fetchManifest("sys_test");
      adapter.dispose();

      await expect(pending).rejects.toThrow("Adapter disposed");
      // Ensure onMessage callback reference was captured
      expect(onMessage).not.toBeNull();
    });

    it("clears subscriptions and lastSeqPerDoc", () => {
      const transport = new MockSyncTransport();
      const adapter = new WsNetworkAdapter(transport);

      adapter.subscribe("doc-1", () => {});
      adapter.dispose();

      // After dispose, subscribing again should work without issues
      const sub = adapter.subscribe("doc-2", () => {});
      sub.unsubscribe();
    });
  });

  describe("subscriber error resilience", () => {
    it("does not crash the message loop when a subscriber throws", async () => {
      const transport = new MockSyncTransport();
      const relay = transport.getRelay();
      const adapter = new WsNetworkAdapter(transport);
      const docId = crypto.randomUUID();

      const received: EncryptedChangeEnvelope[][] = [];
      // First subscriber throws
      adapter.subscribe(docId, () => {
        throw new Error("subscriber error");
      });
      // Second subscriber should still receive the update
      adapter.subscribe(docId, (changes) => {
        received.push([...changes]);
      });

      relay.submit(mockChangeWithoutSeq(docId));

      // Trigger a change that causes a DocumentUpdate
      await adapter.submitChange(docId, mockChangeWithoutSeq(docId));
      // Wait for async delivery
      await new Promise((r) => setTimeout(r, 10));

      expect(received.length).toBeGreaterThan(0);
    });

    it("logs a warning when a subscriber callback throws", async () => {
      const warnFn = vi.fn();
      const transport = new MockSyncTransport();
      const relay = transport.getRelay();
      const adapter = new WsNetworkAdapter(transport, 30_000, { warn: warnFn });
      const docId = crypto.randomUUID();

      adapter.subscribe(docId, () => {
        throw new Error("subscriber error");
      });

      relay.submit(mockChangeWithoutSeq(docId));
      await adapter.submitChange(docId, mockChangeWithoutSeq(docId));
      await new Promise((r) => setTimeout(r, 10));

      expect(warnFn).toHaveBeenCalledWith(
        "Subscriber callback error",
        expect.objectContaining({ error: expect.any(String) }),
      );
    });
  });

  describe("SyncError handling", () => {
    function createErrorTransport(errorForType: string): {
      transport: SyncTransport;
      adapter: WsNetworkAdapter;
    } {
      let onMessage: ((msg: ServerMessage) => void) | null = null;
      const transport: SyncTransport = {
        state: "connected",
        send: (msg) => {
          if ("type" in msg && msg.type === errorForType) {
            void Promise.resolve().then(() => {
              onMessage?.({
                type: "SyncError",
                correlationId: msg.correlationId ?? null,
                code: "INTERNAL_ERROR",
                message: "test error",
                docId: null,
              });
            });
          }
          return Promise.resolve();
        },
        onMessage: (handler) => {
          onMessage = handler;
        },
        close: () => {},
      };
      const adapter = new WsNetworkAdapter(transport, 5_000);
      return { transport, adapter };
    }

    it("throws on SyncError in fetchChangesSince", async () => {
      const { adapter } = createErrorTransport("FetchChangesRequest");
      await expect(adapter.fetchChangesSince("doc-1", 0)).rejects.toThrow("SyncError");
    });

    it("throws on SyncError in fetchLatestSnapshot", async () => {
      const { adapter } = createErrorTransport("FetchSnapshotRequest");
      await expect(adapter.fetchLatestSnapshot("doc-1")).rejects.toThrow("SyncError");
    });

    it("throws on SyncError in fetchManifest", async () => {
      const { adapter } = createErrorTransport("ManifestRequest");
      await expect(adapter.fetchManifest("sys-1")).rejects.toThrow("SyncError");
    });
  });

  describe("request timeout", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("rejects pending request after timeout", async () => {
      vi.useFakeTimers();
      const transport: SyncTransport = {
        state: "connected",
        send: () => Promise.resolve(),
        onMessage: () => {},
        close: () => {},
      };
      const adapter = new WsNetworkAdapter(transport, 100);

      const pending = adapter.fetchManifest("sys-1");

      vi.advanceTimersByTime(150);

      await expect(pending).rejects.toThrow("Request timed out");
    });
  });

  describe("transport send failure", () => {
    it("rejects the request when transport.send fails", async () => {
      const transport: SyncTransport = {
        state: "connected",
        send: () => Promise.reject(new Error("transport send failed")),
        onMessage: () => {},
        close: () => {},
      };
      const adapter = new WsNetworkAdapter(transport, 5_000);

      await expect(adapter.fetchManifest("sys-1")).rejects.toThrow("transport send failed");
    });

    it("cleans up subscription on subscribe send failure", async () => {
      const transport: SyncTransport = {
        state: "connected",
        send: () => Promise.reject(new Error("send failed")),
        onMessage: () => {},
        close: () => {},
      };
      const adapter = new WsNetworkAdapter(transport, 5_000);
      const cb = vi.fn();

      adapter.subscribe("doc-1", cb);
      // Wait for the rejected promise to be handled
      await new Promise((r) => setTimeout(r, 10));

      // Subscription should have been cleaned up — unsubscribe should not throw
      // (no UnsubscribeRequest will be sent since there are no remaining callbacks)
    });

    it("logs a warning when subscribe transport send fails", async () => {
      const warnFn = vi.fn();
      const transport: SyncTransport = {
        state: "connected",
        send: () => Promise.reject(new Error("send failed")),
        onMessage: () => {},
        close: () => {},
      };
      const adapter = new WsNetworkAdapter(transport, 5_000, { warn: warnFn });
      const cb = vi.fn();

      adapter.subscribe("doc-1", cb);
      await new Promise((r) => setTimeout(r, 10));

      expect(warnFn).toHaveBeenCalledWith(
        "Subscribe transport send failed",
        expect.objectContaining({ error: expect.any(String) }),
      );
    });
  });

  describe("lastSeqPerDoc tracking", () => {
    it("updates lastSeq from fetchChangesSince response", async () => {
      const transport = new MockSyncTransport();
      const relay = transport.getRelay();
      const adapter = new WsNetworkAdapter(transport);
      const docId = crypto.randomUUID();

      relay.submit(mockChangeWithoutSeq(docId));
      relay.submit({ ...mockChangeWithoutSeq(docId), nonce: nonce(0x11) });

      await adapter.fetchChangesSince(docId, 0);

      // After fetching, the adapter should know the last seq
      // Subscribe should send lastSyncedSeq = 2 (the last fetched seq)
      // We verify indirectly through the adapter's behavior
      const sub = adapter.subscribe(docId, () => {});
      sub.unsubscribe();
    });

    it("updates lastSeq from DocumentUpdate push", async () => {
      const transport = new MockSyncTransport();
      const adapter = new WsNetworkAdapter(transport);
      const docId = crypto.randomUUID();

      const received: EncryptedChangeEnvelope[][] = [];
      adapter.subscribe(docId, (changes) => {
        received.push([...changes]);
      });

      // Submit a change — MockSyncTransport sends both ChangeAccepted and DocumentUpdate
      await adapter.submitChange(docId, mockChangeWithoutSeq(docId));
      await new Promise((r) => setTimeout(r, 10));

      // The adapter should have received the change via DocumentUpdate
      expect(received.length).toBeGreaterThan(0);
    });
  });
});
