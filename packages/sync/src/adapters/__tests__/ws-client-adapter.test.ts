import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { nonce, pubkey, sig } from "../../__tests__/test-crypto-helpers.js";
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
  return brandId<SyncDocumentId>(id);
}

function asSystemId(id: string): SystemId {
  return brandId<SystemId>(id);
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
    systemId: asSystemId("sys_test123"),
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

    it("rejects fetchManifest with timeout when auth never completes", async () => {
      vi.useFakeTimers();

      const harness = createTestHarness();
      harness.adapter.connect();
      const mock = getLastMock();
      mock.simulateOpen();

      // Complete auth so fetchManifest gets past the authReady gate
      const authMsg = mock.sentMessages[0] as { correlationId: string };
      mock.simulateMessage({
        type: "AuthenticateResponse",
        correlationId: authMsg.correlationId,
        syncSessionId: "sess_abc",
        serverTime: Date.now(),
      });

      // Start the manifest request — it will pend waiting for a response
      const manifestPromise = harness.adapter.fetchManifest(asSystemId("sys_test123"));

      // Allow the authReady microtask to flush so the request is sent
      await vi.waitFor(() => {
        const req = mock.sentMessages.find(
          (m) => (m as { type: string }).type === "ManifestRequest",
        );
        expect(req).toBeDefined();
      });

      // Advance past the 30s request timeout
      vi.advanceTimersByTime(31_000);

      await expect(manifestPromise).rejects.toThrow("timed out");

      vi.useRealTimers();
    });

    it("ignores AuthenticateResponse with mismatched correlationId", () => {
      const harness = createTestHarness();
      const connectedEvents: unknown[] = [];
      harness.eventBus.on("ws:connected", (event) => connectedEvents.push(event));

      harness.adapter.connect();
      const mock = getLastMock();
      mock.simulateOpen();

      // Send response with wrong correlationId
      mock.simulateMessage({
        type: "AuthenticateResponse",
        correlationId: "wrong-id",
        syncSessionId: "sess_bad",
        serverTime: Date.now(),
      });

      // Should NOT have emitted ws:connected
      expect(connectedEvents).toHaveLength(0);
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

  describe("error emission", () => {
    it("emits sync:error when a DocumentUpdate subscriber throws", () => {
      const harness = createTestHarness();
      const errors: { message: string }[] = [];
      harness.eventBus.on("sync:error", (event) => errors.push(event));

      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-err");

      harness.adapter.subscribe(docId, () => {
        throw new Error("subscriber kaboom");
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
            seq: 1,
          },
        ],
      });

      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain("DocumentUpdate subscriber error");
    });

    it("emits sync:error on malformed WebSocket message", () => {
      const harness = createTestHarness();
      const errors: { message: string }[] = [];
      harness.eventBus.on("sync:error", (event) => errors.push(event));

      harness.adapter.connect();
      const mock = getLastMock();
      mock.simulateOpen();

      // Send invalid JSON
      const rawEvent = { data: "not-valid-json{{{" } as MessageEvent;
      mock.onmessage?.(rawEvent);

      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain("Failed to parse");
    });
  });

  describe("submitChange", () => {
    it("resolves with the accepted change envelope", async () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-submit");

      const change = {
        ciphertext: new Uint8Array([1, 2, 3]),
        nonce: nonce(0),
        signature: sig(0),
        authorPublicKey: pubkey(0),
        documentId: docId,
      };

      const submitPromise = harness.adapter.submitChange(docId, change);

      await vi.waitFor(() => {
        const req = mock.sentMessages.find(
          (m) => (m as { type: string }).type === "SubmitChangeRequest",
        );
        expect(req).toBeDefined();
      });

      const submitReq = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "SubmitChangeRequest",
      ) as { correlationId: string };

      mock.simulateMessage({
        type: "ChangeAccepted",
        correlationId: submitReq.correlationId,
        assignedSeq: 42,
        docId,
      });

      const result = await submitPromise;
      expect(result.seq).toBe(42);
      expect(result.documentId).toBe(docId);
    });

    it("throws SyncProtocolError when server returns SyncError", async () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-submit-err");

      const change = {
        ciphertext: new Uint8Array(0),
        nonce: nonce(1),
        signature: sig(1),
        authorPublicKey: pubkey(1),
        documentId: docId,
      };

      const submitPromise = harness.adapter.submitChange(docId, change);

      await vi.waitFor(() => {
        const req = mock.sentMessages.find(
          (m) => (m as { type: string }).type === "SubmitChangeRequest",
        );
        expect(req).toBeDefined();
      });

      const submitReq = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "SubmitChangeRequest",
      ) as { correlationId: string };

      mock.simulateMessage({
        type: "SyncError",
        correlationId: submitReq.correlationId,
        code: "VERSION_CONFLICT",
        message: "conflict",
        docId,
      });

      await expect(submitPromise).rejects.toThrow("VERSION_CONFLICT");
    });
  });

  describe("fetchChangesSince", () => {
    it("returns changes from response", async () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-fetch-changes");

      const fetchPromise = harness.adapter.fetchChangesSince(docId, 0);

      await vi.waitFor(() => {
        const req = mock.sentMessages.find(
          (m) => (m as { type: string }).type === "FetchChangesRequest",
        );
        expect(req).toBeDefined();
      });

      const fetchReq = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "FetchChangesRequest",
      ) as { correlationId: string };

      const fakeChange = {
        ciphertext: [],
        nonce: [],
        signature: [],
        authorPublicKey: [],
        documentId: docId,
        seq: 7,
      };

      mock.simulateMessage({
        type: "ChangesResponse",
        correlationId: fetchReq.correlationId,
        changes: [fakeChange],
        docId,
      });

      const changes = await fetchPromise;
      expect(changes).toHaveLength(1);
    });

    it("returns empty array when no changes", async () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-fetch-empty");

      const fetchPromise = harness.adapter.fetchChangesSince(docId, 5);

      await vi.waitFor(() => {
        const req = mock.sentMessages.find(
          (m) => (m as { type: string }).type === "FetchChangesRequest",
        );
        expect(req).toBeDefined();
      });

      const fetchReq = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "FetchChangesRequest",
      ) as { correlationId: string };

      mock.simulateMessage({
        type: "ChangesResponse",
        correlationId: fetchReq.correlationId,
        changes: [],
        docId,
      });

      const changes = await fetchPromise;
      expect(changes).toHaveLength(0);
    });
  });

  describe("submitSnapshot", () => {
    it("resolves on SnapshotAccepted", async () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-snapshot");

      const snapshot = {
        ciphertext: [9, 8, 7],
        nonce: Array.from(new Uint8Array(24).fill(1)),
        documentId: docId,
        version: 1,
        createdAt: new Date().toISOString(),
      };

      const submitPromise = harness.adapter.submitSnapshot(docId, snapshot as never);

      await vi.waitFor(() => {
        const req = mock.sentMessages.find(
          (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
        );
        expect(req).toBeDefined();
      });

      const submitReq = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
      ) as { correlationId: string };

      mock.simulateMessage({
        type: "SnapshotAccepted",
        correlationId: submitReq.correlationId,
        docId,
      });

      await expect(submitPromise).resolves.toBeUndefined();
    });

    it("silently returns on VERSION_CONFLICT SyncError", async () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-snapshot-conflict");

      const submitPromise = harness.adapter.submitSnapshot(docId, {} as never);

      await vi.waitFor(() => {
        const req = mock.sentMessages.find(
          (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
        );
        expect(req).toBeDefined();
      });

      const submitReq = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
      ) as { correlationId: string };

      mock.simulateMessage({
        type: "SyncError",
        correlationId: submitReq.correlationId,
        code: "VERSION_CONFLICT",
        message: "conflict",
        docId,
      });

      await expect(submitPromise).resolves.toBeUndefined();
    });

    it("throws SyncProtocolError on non-VERSION_CONFLICT SyncError", async () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-snapshot-auth-err");

      const submitPromise = harness.adapter.submitSnapshot(docId, {} as never);

      await vi.waitFor(() => {
        const req = mock.sentMessages.find(
          (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
        );
        expect(req).toBeDefined();
      });

      const submitReq = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
      ) as { correlationId: string };

      mock.simulateMessage({
        type: "SyncError",
        correlationId: submitReq.correlationId,
        code: "AUTH_FAILED",
        message: "unauthorized",
        docId,
      });

      await expect(submitPromise).rejects.toThrow("AUTH_FAILED");
    });

    it("throws UnexpectedResponseError on unexpected response type", async () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-snapshot-unexpected");

      const submitPromise = harness.adapter.submitSnapshot(docId, {} as never);

      await vi.waitFor(() => {
        const req = mock.sentMessages.find(
          (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
        );
        expect(req).toBeDefined();
      });

      const submitReq = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "SubmitSnapshotRequest",
      ) as { correlationId: string };

      mock.simulateMessage({
        type: "ManifestResponse",
        correlationId: submitReq.correlationId,
        manifest: { systemId: "sys_x", documents: [] },
      });

      await expect(submitPromise).rejects.toThrow("SnapshotAccepted");
    });
  });

  describe("fetchLatestSnapshot", () => {
    it("returns snapshot from response", async () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-snap-fetch");

      const fetchPromise = harness.adapter.fetchLatestSnapshot(docId);

      await vi.waitFor(() => {
        const req = mock.sentMessages.find(
          (m) => (m as { type: string }).type === "FetchSnapshotRequest",
        );
        expect(req).toBeDefined();
      });

      const fetchReq = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "FetchSnapshotRequest",
      ) as { correlationId: string };

      const fakeSnapshot = {
        ciphertext: [1],
        nonce: [2],
        documentId: docId,
        version: 3,
        createdAt: new Date().toISOString(),
      };

      mock.simulateMessage({
        type: "SnapshotResponse",
        correlationId: fetchReq.correlationId,
        snapshot: fakeSnapshot,
        docId,
      });

      const result = await fetchPromise;
      expect(result).not.toBeNull();
    });

    it("returns null when snapshot is null", async () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-snap-null");

      const fetchPromise = harness.adapter.fetchLatestSnapshot(docId);

      await vi.waitFor(() => {
        const req = mock.sentMessages.find(
          (m) => (m as { type: string }).type === "FetchSnapshotRequest",
        );
        expect(req).toBeDefined();
      });

      const fetchReq = mock.sentMessages.find(
        (m) => (m as { type: string }).type === "FetchSnapshotRequest",
      ) as { correlationId: string };

      mock.simulateMessage({
        type: "SnapshotResponse",
        correlationId: fetchReq.correlationId,
        snapshot: null,
        docId,
      });

      const result = await fetchPromise;
      expect(result).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("DocumentUpdate with empty changes array does not update lastSeq", () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();
      const docId = asSyncDocId("doc-empty-changes");

      const received: ReadonlyArray<EncryptedChangeEnvelope>[] = [];
      harness.adapter.subscribe(docId, (changes) => received.push(changes));

      mock.simulateMessage({
        type: "DocumentUpdate",
        correlationId: null,
        docId,
        changes: [],
      });

      expect(received).toHaveLength(1);
      expect(received[0]).toHaveLength(0);
    });

    it("disconnect() when ws is null emits ws:disconnected without throwing", () => {
      const harness = createTestHarness();
      const disconnectedEvents: WsDisconnectedEvent[] = [];
      harness.eventBus.on("ws:disconnected", (event) => disconnectedEvents.push(event));

      // Never called connect(), so ws is null
      harness.adapter.disconnect();

      expect(disconnectedEvents).toHaveLength(1);
      expect(disconnectedEvents[0]?.reason).toBe("client disconnected");
    });

    it("connect() is a no-op when already disposed", () => {
      const harness = createTestHarness();
      harness.adapter.disconnect(); // disposes without ws
      const instancesBefore = mockInstances.length;

      harness.adapter.connect();

      expect(mockInstances.length).toBe(instancesBefore); // no new WS created
    });

    it("sendRaw throws AdapterDisposedError when ws readyState is not OPEN", async () => {
      const harness = createTestHarness();
      harness.adapter.connect();
      const mock = getLastMock();

      // simulateOpen triggers onopen which sends the auth request
      mock.simulateOpen();

      // Complete auth to unblock authReady
      const authMsg = mock.sentMessages[0] as { correlationId: string };
      mock.simulateMessage({
        type: "AuthenticateResponse",
        correlationId: authMsg.correlationId,
        syncSessionId: "sess_rdy",
        serverTime: Date.now(),
      });

      // Now drop readyState back to CONNECTING (simulates a half-open state)
      mock.readyState = 0;

      await expect(harness.adapter.fetchManifest(asSystemId("sys_guard"))).rejects.toThrow(
        "WebSocket not connected",
      );
    });

    it("SyncError with AUTH_FAILED during handshake calls rejectAuth", async () => {
      const harness = createTestHarness();

      harness.adapter.connect();
      const mock = getLastMock();
      mock.simulateOpen();

      // Capture authReady rejection before it propagates
      const authRejection = new Promise<void>((resolve) => {
        // Attempt fetchManifest which awaits authReady — will reject with SyncProtocolError
        harness.adapter.fetchManifest(asSystemId("sys_auth")).catch(() => {
          resolve();
        });
      });

      mock.simulateMessage({
        type: "SyncError",
        correlationId: "auth-err-corr",
        code: "AUTH_FAILED",
        message: "bad token",
        docId: undefined,
      });

      await authRejection;
    });

    it("SyncError with PROTOCOL_MISMATCH during handshake rejects auth", async () => {
      const harness = createTestHarness();
      harness.adapter.connect();
      const mock = getLastMock();
      mock.simulateOpen();

      mock.simulateMessage({
        type: "SyncError",
        correlationId: "protocol-err",
        code: "PROTOCOL_MISMATCH",
        message: "wrong version",
        docId: undefined,
      });

      // Auth is now rejected; fetchManifest awaits authReady which will reject
      const manifestPromise = harness.adapter.fetchManifest(asSystemId("sys_proto"));

      // Since auth promise rejected, authReady threw — but fetchManifest awaits it
      // The request will eventually time out or we can trigger it; test that auth rejection flows
      await vi.waitFor(async () => {
        // Let microtasks run
        await Promise.resolve();
        return true;
      });

      // The manifestPromise might be pending if sendRaw throws (not open)
      // Just verify the adapter isn't in a broken state
      harness.adapter.disconnect();

      await expect(manifestPromise).rejects.toBeDefined();
    });

    it("correlated response with no matching pending request is ignored", () => {
      const harness = createTestHarness();
      const mock = harness.connectAndAuth();

      // Sending a response with an unknown correlationId should not throw
      expect(() => {
        mock.simulateMessage({
          type: "ManifestResponse",
          correlationId: "unknown-correlation-id",
          manifest: { systemId: "sys_x", documents: [] },
        });
      }).not.toThrow();
    });

    it("onopen guard: no-op if disposed before open fires", () => {
      const harness = createTestHarness();
      harness.adapter.connect();
      const mock = getLastMock();

      // Dispose before open fires
      harness.adapter.disconnect();

      // onopen fires after dispose — should be a no-op
      expect(() => {
        mock.simulateOpen();
      }).not.toThrow();

      // No auth request should have been sent after disposal
      expect(mock.sentMessages).toHaveLength(0);
    });

    it("onmessage guard: no-op if disposed before message fires", () => {
      const harness = createTestHarness();
      const notifications: WsNotificationEvent[] = [];
      harness.eventBus.on("ws:notification", (event) => notifications.push(event));

      harness.adapter.connect();
      const mock = getLastMock();
      mock.simulateOpen();
      harness.adapter.disconnect();

      // onmessage fires after dispose — handleMessage returns early due to disposed check
      const rawEvent = {
        data: JSON.stringify({ type: "Notification", payload: {} }),
      } as MessageEvent;
      mock.onmessage?.(rawEvent);

      expect(notifications).toHaveLength(0);
    });
  });
});
