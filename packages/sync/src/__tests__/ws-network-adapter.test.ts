import { describe, expect, it, vi } from "vitest";

import { WsNetworkAdapter } from "../adapters/ws-network-adapter.js";

import { MockSyncTransport } from "./mock-sync-transport.js";
import { runNetworkAdapterContract } from "./network-adapter.contract.js";

import type { ClientMessage, ServerMessage, SyncTransport, TransportState } from "../protocol.js";

describe("WsNetworkAdapter", () => {
  function createAdapter(): WsNetworkAdapter {
    const transport = new MockSyncTransport();
    return new WsNetworkAdapter(transport);
  }

  runNetworkAdapterContract(createAdapter);

  describe("SyncError handling", () => {
    /** Builds a transport that replies with a SyncError for every request. */
    function createErrorTransport(code: string, message: string): SyncTransport {
      let handler: ((msg: ServerMessage) => void) | null = null;
      return {
        state: "connected" as TransportState,
        send(msg: ClientMessage): Promise<void> {
          void Promise.resolve().then(() => {
            handler?.({
              type: "SyncError",
              correlationId: msg.correlationId,
              code,
              message,
              docId: "docId" in msg ? (msg as { docId: string }).docId : undefined,
            } as ServerMessage);
          });
          return Promise.resolve();
        },
        onMessage(h: (msg: ServerMessage) => void): void {
          handler = h;
        },
        close(): void {
          /* no-op */
        },
      };
    }

    it("fetchChangesSince throws on SyncError", async () => {
      const transport = createErrorTransport("INTERNAL", "server error");
      const adapter = new WsNetworkAdapter(transport);
      await expect(adapter.fetchChangesSince("doc_test", 0)).rejects.toThrow(
        "SyncError [INTERNAL]: server error",
      );
    });

    it("fetchLatestSnapshot throws on SyncError", async () => {
      const transport = createErrorTransport("INTERNAL", "snapshot error");
      const adapter = new WsNetworkAdapter(transport);
      await expect(adapter.fetchLatestSnapshot("doc_test")).rejects.toThrow(
        "SyncError [INTERNAL]: snapshot error",
      );
    });

    it("fetchManifest throws on SyncError", async () => {
      const transport = createErrorTransport("UNAUTHORIZED", "not allowed");
      const adapter = new WsNetworkAdapter(transport);
      await expect(adapter.fetchManifest("sys_test")).rejects.toThrow(
        "SyncError [UNAUTHORIZED]: not allowed",
      );
    });

    it("subscribe cleans up on server rejection", async () => {
      const transport = createErrorTransport("RATE_LIMITED", "too many subscriptions");
      const adapter = new WsNetworkAdapter(transport);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const callback = vi.fn();
      adapter.subscribe("doc_test", callback);

      // Wait for async subscribe response
      await new Promise((r) => setTimeout(r, 10));

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WsNetworkAdapter] subscribe failed for doc_test"),
      );

      warnSpy.mockRestore();
    });
  });

  describe("dispose guards", () => {
    it("unsubscribe skips send after dispose", () => {
      const transport = new MockSyncTransport();
      const sendSpy = vi.spyOn(transport, "send");
      const adapter = new WsNetworkAdapter(transport);

      const sub = adapter.subscribe("doc_test", () => {});
      adapter.dispose();

      // Clear call count from subscribe's SubscribeRequest
      sendSpy.mockClear();

      // Unsubscribe after dispose should not send
      sub.unsubscribe();

      // No UnsubscribeRequest should have been sent
      const unsubCalls = sendSpy.mock.calls.filter(
        (call) => (call[0] as { type: string }).type === "UnsubscribeRequest",
      );
      expect(unsubCalls).toHaveLength(0);
    });
  });
});
