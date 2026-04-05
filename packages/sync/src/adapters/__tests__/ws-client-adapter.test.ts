import { afterEach, describe, expect, it, vi } from "vitest";

import { createEventBus } from "../../event-bus/event-bus.js";
import { SYNC_PROTOCOL_VERSION } from "../../protocol.js";
import { createWsClientAdapter } from "../ws-client-adapter.js";

import type { EventBus } from "../../event-bus/event-bus.js";
import type {
  DataLayerEventMap,
  WsDisconnectedEvent,
  WsNotificationEvent,
} from "../../event-bus/event-map.js";
import type { EncryptedChangeEnvelope } from "../../types.js";
import type {
  MinimalWebSocket,
  WsClientAdapter,
  WsClientAdapterConfig,
} from "../ws-client-adapter.js";
import type { SyncDocumentId, SystemId } from "@pluralscape/types";

// ── Branded type helpers ────────────────────────────────────────────

function asSyncDocId(id: string): SyncDocumentId {
  return id as SyncDocumentId;
}

function asSystemId(id: string): SystemId {
  return id as SystemId;
}

// ── MockWebSocket ───────────────────────────────────────────────────

/** Tracks all MockWebSocket instances created during tests. */
let mockInstances: MockWebSocket[] = [];

class MockWebSocket implements MinimalWebSocket {
  readonly OPEN = 1;

  readyState = 0; // CONNECTING
  readonly sentMessages: unknown[] = [];

  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent | Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;

  readonly url: string;

  constructor(url: string) {
    this.url = url;
    mockInstances.push(this);
  }

  send(data: string): void {
    this.sentMessages.push(JSON.parse(data));
  }

  close(): void {
    this.readyState = 3; // CLOSED
  }

  // ── Test simulation helpers ──────────────────────────────────

  simulateOpen(): void {
    this.readyState = this.OPEN;
    this.onopen?.(new Event("open"));
  }

  simulateMessage(data: unknown): void {
    const event = { data: JSON.stringify(data) } as MessageEvent;
    this.onmessage?.(event);
  }

  simulateClose(): void {
    this.readyState = 3; // CLOSED
    this.onclose?.(new Event("close"));
  }

  simulateError(): void {
    this.onerror?.(new Event("error"));
  }
}

// ── Test setup ──────────────────────────────────────────────────────

function getLastMock(): MockWebSocket {
  const mock = mockInstances[mockInstances.length - 1];
  if (!mock) throw new Error("No MockWebSocket instances created");
  return mock;
}

interface TestHarness {
  adapter: WsClientAdapter;
  eventBus: EventBus<DataLayerEventMap>;
  /** Connects, opens, and completes the auth handshake. Returns the mock WS. */
  connectAndAuth(): MockWebSocket;
}

function createTestHarness(): TestHarness {
  const eventBus = createEventBus<DataLayerEventMap>();
  const config: WsClientAdapterConfig = {
    url: "wss://test.example.com/sync",
    token: "test-session-token",
    systemId: "sys_test123",
    eventBus,
    WebSocketImpl: MockWebSocket,
  };

  const adapter = createWsClientAdapter(config);

  return {
    adapter,
    eventBus,
    connectAndAuth(): MockWebSocket {
      adapter.connect();
      const mock = getLastMock();
      mock.simulateOpen();

      // Extract the auth request correlationId and respond
      const authMsg = mock.sentMessages[0] as { correlationId: string };
      mock.simulateMessage({
        type: "AuthenticateResponse",
        correlationId: authMsg.correlationId,
        syncSessionId: "sess_abc",
        serverTime: Date.now(),
      });

      return mock;
    },
  };
}

afterEach(() => {
  mockInstances = [];
});

// ── Tests ────────────────────────────────────────────────────────────

describe("createWsClientAdapter", () => {
  describe("auth handshake", () => {
    it("sends AuthenticateRequest on connection open", () => {
      const harness = createTestHarness();

      harness.adapter.connect();
      const mock = getLastMock();
      mock.simulateOpen();

      expect(mock.sentMessages).toHaveLength(1);
      const sent = mock.sentMessages[0] as Record<string, unknown>;
      expect(sent).toMatchObject({
        type: "AuthenticateRequest",
        protocolVersion: SYNC_PROTOCOL_VERSION,
        sessionToken: "test-session-token",
        systemId: "sys_test123",
        profileType: "owner-full",
      });
      expect(sent["correlationId"]).toEqual(expect.any(String));
    });

    it("emits ws:connected after successful auth response", () => {
      const harness = createTestHarness();
      const connectedEvents: unknown[] = [];
      harness.eventBus.on("ws:connected", (event) => connectedEvents.push(event));

      harness.adapter.connect();
      const mock = getLastMock();
      mock.simulateOpen();

      const authMsg = mock.sentMessages[0] as { correlationId: string };
      mock.simulateMessage({
        type: "AuthenticateResponse",
        correlationId: authMsg.correlationId,
        syncSessionId: "sess_abc",
        serverTime: Date.now(),
      });

      expect(connectedEvents).toHaveLength(1);
      expect(connectedEvents[0]).toEqual({ type: "ws:connected" });
    });
  });

  describe("disconnect", () => {
    it("emits ws:disconnected on close", () => {
      const harness = createTestHarness();
      const disconnectedEvents: WsDisconnectedEvent[] = [];
      harness.eventBus.on("ws:disconnected", (event) => disconnectedEvents.push(event));

      harness.adapter.connect();
      const mock = getLastMock();
      mock.simulateOpen();
      mock.simulateClose();

      expect(disconnectedEvents).toHaveLength(1);
      expect(disconnectedEvents[0]?.reason).toBe("connection closed");
    });

    it("disconnect() closes the WebSocket and emits ws:disconnected", () => {
      const harness = createTestHarness();
      const disconnectedEvents: WsDisconnectedEvent[] = [];
      harness.eventBus.on("ws:disconnected", (event) => disconnectedEvents.push(event));

      harness.connectAndAuth();
      harness.adapter.disconnect();

      expect(disconnectedEvents).toHaveLength(1);
      expect(disconnectedEvents[0]?.reason).toBe("client disconnected");
    });

    it("close() tears down the connection", () => {
      const harness = createTestHarness();
      const disconnectedEvents: WsDisconnectedEvent[] = [];
      harness.eventBus.on("ws:disconnected", (event) => disconnectedEvents.push(event));

      harness.connectAndAuth();
      void harness.adapter.close();

      expect(disconnectedEvents).toHaveLength(1);
      expect(disconnectedEvents[0]?.reason).toBe("client disconnected");
    });
  });

  describe("notification demux", () => {
    it("routes Notification messages to ws:notification on the event bus", () => {
      const harness = createTestHarness();
      const notifications: WsNotificationEvent[] = [];
      harness.eventBus.on("ws:notification", (event) => notifications.push(event));

      harness.adapter.connect();
      const mock = getLastMock();
      mock.simulateOpen();

      // Complete auth
      const authMsg = mock.sentMessages[0] as { correlationId: string };
      mock.simulateMessage({
        type: "AuthenticateResponse",
        correlationId: authMsg.correlationId,
        syncSessionId: "sess_abc",
        serverTime: Date.now(),
      });

      // Send a notification
      mock.simulateMessage({
        type: "Notification",
        payload: { kind: "front-switch", memberId: "mem_abc" },
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toEqual({
        type: "ws:notification",
        payload: { kind: "front-switch", memberId: "mem_abc" },
      });
    });
  });

  describe("DocumentUpdate routing", () => {
    it("routes DocumentUpdate to subscription callbacks", () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-test-1");

      const received: ReadonlyArray<EncryptedChangeEnvelope>[] = [];
      harness.adapter.subscribe(docId, (changes) => {
        received.push(changes);
      });

      const fakeChanges = [
        {
          ciphertext: Array.from(new Uint8Array([1, 2, 3])),
          nonce: Array.from(new Uint8Array(24).fill(0xaa)),
          signature: Array.from(new Uint8Array(64).fill(0xbb)),
          authorPublicKey: Array.from(new Uint8Array(32).fill(0xcc)),
          documentId: docId,
          seq: 1,
        },
      ];

      mock.simulateMessage({
        type: "DocumentUpdate",
        correlationId: null,
        docId,
        changes: fakeChanges,
      });

      expect(received).toHaveLength(1);
      expect(received[0]).toHaveLength(1);
    });

    it("does not deliver DocumentUpdate to unsubscribed callbacks", () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-test-2");

      const received: ReadonlyArray<EncryptedChangeEnvelope>[] = [];
      const sub = harness.adapter.subscribe(docId, (changes) => {
        received.push(changes);
      });
      sub.unsubscribe();

      mock.simulateMessage({
        type: "DocumentUpdate",
        correlationId: null,
        docId,
        changes: [],
      });

      expect(received).toHaveLength(0);
    });

    it("subscriber errors do not break other subscribers", () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-resilient");

      const received: ReadonlyArray<EncryptedChangeEnvelope>[] = [];
      harness.adapter.subscribe(docId, () => {
        throw new Error("subscriber boom");
      });
      harness.adapter.subscribe(docId, (changes) => {
        received.push(changes);
      });

      mock.simulateMessage({
        type: "DocumentUpdate",
        correlationId: null,
        docId,
        changes: [
          {
            ciphertext: [],
            nonce: [],
            signature: [],
            authorPublicKey: [],
            documentId: docId,
            seq: 5,
          },
        ],
      });

      expect(received).toHaveLength(1);
    });
  });

  describe("request/response correlation", () => {
    it("resolves fetchManifest with correlated response", async () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();

      const manifestPromise = harness.adapter.fetchManifest(asSystemId("sys_test123"));

      // Allow the authReady microtask to flush so the request is sent
      await vi.waitFor(() => {
        const req = mock.sentMessages.find(
          (m) => (m as { type: string }).type === "ManifestRequest",
        );
        expect(req).toBeDefined();
      });

      const manifestReq = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "ManifestRequest",
      ) as { correlationId: string };

      mock.simulateMessage({
        type: "ManifestResponse",
        correlationId: manifestReq.correlationId,
        manifest: {
          systemId: "sys_test123",
          documents: [],
        },
      });

      const manifest = await manifestPromise;
      expect(manifest.systemId).toBe("sys_test123");
      expect(manifest.documents).toHaveLength(0);
    });

    it("rejects requests after disconnect with AdapterDisposedError", async () => {
      const harness = createTestHarness();
      harness.connectAndAuth();
      harness.adapter.disconnect();

      await expect(harness.adapter.fetchManifest(asSystemId("sys_test"))).rejects.toThrow(
        "Adapter disposed",
      );
    });
  });

  describe("ws:disconnected on error", () => {
    it("emits ws:disconnected on WebSocket error", () => {
      const harness = createTestHarness();
      const disconnectedEvents: WsDisconnectedEvent[] = [];
      harness.eventBus.on("ws:disconnected", (event) => disconnectedEvents.push(event));

      harness.adapter.connect();
      const mock = getLastMock();
      mock.simulateError();

      expect(disconnectedEvents).toHaveLength(1);
      expect(disconnectedEvents[0]?.reason).toBe("connection error");
    });
  });

  describe("disposed state", () => {
    it("ignores messages after dispose", () => {
      const harness = createTestHarness();
      const notifications: WsNotificationEvent[] = [];
      harness.eventBus.on("ws:notification", (event) => notifications.push(event));

      harness.adapter.connect();
      const mock = getLastMock();
      mock.simulateOpen();
      harness.adapter.disconnect();

      // Simulate a message arriving after disconnect
      mock.simulateMessage({
        type: "Notification",
        payload: { late: true },
      });

      expect(notifications).toHaveLength(0);
    });
  });
});
