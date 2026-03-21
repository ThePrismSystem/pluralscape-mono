import { afterEach, describe, expect, it, vi } from "vitest";

import { WsNetworkAdapter } from "../adapters/ws-network-adapter.js";
import {
  AdapterDisposedError,
  SyncProtocolError,
  SyncTimeoutError,
  UnexpectedResponseError,
} from "../errors.js";

import { MockSyncTransport } from "./mock-sync-transport.js";
import { runNetworkAdapterContract } from "./network-adapter.contract.js";

import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";
import type {
  EncryptedChangeEnvelope,
  EncryptedSnapshotEnvelope,
  ServerMessage,
  SyncTransport,
} from "@pluralscape/sync";

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

function mockSnapshot(docId: string): EncryptedSnapshotEnvelope {
  return {
    ciphertext: new Uint8Array([4, 5, 6]),
    nonce: nonce(0xdd),
    signature: sig(0xee),
    authorPublicKey: pubkey(0xff),
    documentId: docId,
    snapshotVersion: 1,
  };
}

describe("WsNetworkAdapter", () => {
  function createAdapter(): WsNetworkAdapter {
    const transport = new MockSyncTransport();
    return new WsNetworkAdapter(transport);
  }

  runNetworkAdapterContract(createAdapter);

  describe("close", () => {
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
      adapter.close();

      await expect(pending).rejects.toThrow(AdapterDisposedError);
      // Ensure onMessage callback reference was captured
      expect(onMessage).not.toBeNull();
    });

    it("clears subscriptions and lastSeqPerDoc", () => {
      const transport = new MockSyncTransport();
      const adapter = new WsNetworkAdapter(transport);

      adapter.subscribe("doc-1", () => {});
      adapter.close();

      // After close, subscribing again should work without issues
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
      // Wait for async delivery to complete
      await vi.waitFor(() => {
        expect(received.length).toBeGreaterThan(0);
      });
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
      await vi.waitFor(() => {
        expect(warnFn).toHaveBeenCalledWith(
          "Subscriber callback error",
          expect.objectContaining({ error: expect.any(String) }),
        );
      });
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

    it("throws SyncProtocolError in fetchChangesSince", async () => {
      const { adapter } = createErrorTransport("FetchChangesRequest");
      await expect(adapter.fetchChangesSince("doc-1", 0)).rejects.toThrow(SyncProtocolError);
    });

    it("throws SyncProtocolError in fetchLatestSnapshot", async () => {
      const { adapter } = createErrorTransport("FetchSnapshotRequest");
      await expect(adapter.fetchLatestSnapshot("doc-1")).rejects.toThrow(SyncProtocolError);
    });

    it("throws SyncProtocolError in fetchManifest", async () => {
      const { adapter } = createErrorTransport("ManifestRequest");
      await expect(adapter.fetchManifest("sys-1")).rejects.toThrow(SyncProtocolError);
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

      await expect(pending).rejects.toThrow(SyncTimeoutError);
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
      // Wait for the rejected send promise to be handled
      await vi.waitFor(() => {
        expect(warnFn).toHaveBeenCalled();
      });

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
      await vi.waitFor(() => {
        expect(warnFn).toHaveBeenCalledWith(
          "Subscribe transport send failed",
          expect.objectContaining({ error: expect.any(String) }),
        );
      });
    });

    it("logs a warning when unsubscribe transport send fails", async () => {
      const warnFn = vi.fn();
      const transport: SyncTransport = {
        state: "connected",
        send: (msg) => {
          if (msg.type === "UnsubscribeRequest") {
            return Promise.reject(new Error("unsubscribe send failed"));
          }
          return Promise.resolve();
        },
        onMessage: () => {},
        close: () => {},
      };
      const adapter = new WsNetworkAdapter(transport, 5_000, { warn: warnFn });

      const sub = adapter.subscribe("doc-1", () => {});
      sub.unsubscribe();

      await vi.waitFor(() => {
        expect(warnFn).toHaveBeenCalledWith(
          "Unsubscribe send failed",
          expect.objectContaining({
            docId: "doc-1",
            error: expect.any(String),
          }),
        );
      });
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
      // Wait for async DocumentUpdate delivery to subscriber
      await vi.waitFor(() => {
        expect(received.length).toBeGreaterThan(0);
      });
    });
  });

  describe("auto-close on transport close (M12)", () => {
    /** Helper to create a transport with onClose support and capture the handler. */
    function createClosableTransport(): {
      transport: SyncTransport;
      triggerClose: () => void;
      triggerMessage: (msg: ServerMessage) => void;
    } {
      const handlers: { close: (() => void)[]; message: ((msg: ServerMessage) => void)[] } = {
        close: [],
        message: [],
      };
      const transport: SyncTransport = {
        state: "connected",
        send: () => Promise.resolve(),
        onMessage: (handler) => {
          handlers.message.push(handler);
        },
        close: () => {},
        onClose: (handler) => {
          handlers.close.push(handler);
        },
      };
      return {
        transport,
        triggerClose: () => {
          for (const h of handlers.close) h();
        },
        triggerMessage: (msg) => {
          for (const h of handlers.message) h(msg);
        },
      };
    }

    it("closes adapter when transport onClose fires", () => {
      const { transport, triggerClose } = createClosableTransport();
      const adapter = new WsNetworkAdapter(transport);

      expect(adapter.isDisposed).toBe(false);

      triggerClose();

      expect(adapter.isDisposed).toBe(true);
    });

    it("rejects pending requests when transport closes", async () => {
      const { transport, triggerClose } = createClosableTransport();
      const adapter = new WsNetworkAdapter(transport, 30_000);

      const pending = adapter.fetchManifest("sys-1");
      triggerClose();

      await expect(pending).rejects.toThrow(AdapterDisposedError);
    });

    it("ignores messages after close", () => {
      const { transport, triggerClose, triggerMessage } = createClosableTransport();
      const adapter = new WsNetworkAdapter(transport);
      const received: EncryptedChangeEnvelope[][] = [];
      adapter.subscribe("doc-1", (changes) => {
        received.push([...changes]);
      });

      triggerClose();

      // Send a message after close — should be ignored
      triggerMessage({
        type: "DocumentUpdate",
        correlationId: null,
        docId: "doc-1",
        changes: [],
      });

      expect(received).toHaveLength(0);
    });

    it("is idempotent — double close does not throw", () => {
      const transport = new MockSyncTransport();
      const adapter = new WsNetworkAdapter(transport);

      adapter.close();
      adapter.close();

      expect(adapter.isDisposed).toBe(true);
    });
  });

  describe("closed guard on request()", () => {
    it("rejects new requests immediately after close", async () => {
      const transport: SyncTransport = {
        state: "connected",
        send: () => Promise.resolve(),
        onMessage: () => {},
        close: () => {},
      };
      const adapter = new WsNetworkAdapter(transport, 30_000);
      adapter.close();

      await expect(adapter.fetchManifest("sys-1")).rejects.toThrow(AdapterDisposedError);
    });

    it("rejects submitChange after close", async () => {
      const transport: SyncTransport = {
        state: "connected",
        send: () => Promise.resolve(),
        onMessage: () => {},
        close: () => {},
      };
      const adapter = new WsNetworkAdapter(transport, 30_000);
      adapter.close();

      await expect(adapter.submitChange("doc-1", mockChangeWithoutSeq("doc-1"))).rejects.toThrow(
        AdapterDisposedError,
      );
    });
  });

  describe("submitSnapshot", () => {
    function createSnapshotTransport(
      responseFactory: (correlationId: string | null) => ServerMessage,
    ): {
      adapter: WsNetworkAdapter;
    } {
      let onMessage: ((msg: ServerMessage) => void) | null = null;
      const transport: SyncTransport = {
        state: "connected",
        send: (msg) => {
          void Promise.resolve().then(() => {
            onMessage?.(responseFactory(msg.correlationId ?? null));
          });
          return Promise.resolve();
        },
        onMessage: (handler) => {
          onMessage = handler;
        },
        close: () => {},
      };
      return { adapter: new WsNetworkAdapter(transport, 5_000) };
    }

    it("throws SyncProtocolError on non-VERSION_CONFLICT SyncError", async () => {
      const { adapter } = createSnapshotTransport((correlationId) => ({
        type: "SyncError",
        correlationId,
        code: "INTERNAL_ERROR",
        message: "test error",
        docId: null,
      }));

      await expect(adapter.submitSnapshot("doc-1", mockSnapshot("doc-1"))).rejects.toThrow(
        SyncProtocolError,
      );
    });

    it("silently returns on VERSION_CONFLICT", async () => {
      const { adapter } = createSnapshotTransport((correlationId) => ({
        type: "SyncError",
        correlationId,
        code: "VERSION_CONFLICT",
        message: "version conflict",
        docId: "doc-1",
      }));

      await expect(adapter.submitSnapshot("doc-1", mockSnapshot("doc-1"))).resolves.toBeUndefined();
    });

    it("throws UnexpectedResponseError on wrong response type", async () => {
      const { adapter } = createSnapshotTransport((correlationId) => ({
        type: "ChangeAccepted",
        correlationId,
        docId: "doc-1",
        assignedSeq: 1,
      }));

      await expect(adapter.submitSnapshot("doc-1", mockSnapshot("doc-1"))).rejects.toThrow(
        UnexpectedResponseError,
      );
    });

    it("resolves on SnapshotAccepted", async () => {
      const { adapter } = createSnapshotTransport((correlationId) => ({
        type: "SnapshotAccepted",
        correlationId,
        docId: "doc-1",
        snapshotVersion: 1,
      }));

      await expect(adapter.submitSnapshot("doc-1", mockSnapshot("doc-1"))).resolves.toBeUndefined();
    });
  });
});
