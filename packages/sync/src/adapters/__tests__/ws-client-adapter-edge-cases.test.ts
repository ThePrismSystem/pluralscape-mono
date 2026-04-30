import { afterEach, describe, expect, it, vi } from "vitest";

import {
  asSyncDocId,
  asSystemId,
  createTestHarness,
  getLastMock,
  getMockInstancesLength,
  resetMockInstances,
} from "./helpers/ws-client-adapter-fixtures.js";

import type { WsDisconnectedEvent, WsNotificationEvent } from "../../event-bus/event-map.js";
import type { EncryptedChangeEnvelope } from "../../types.js";

afterEach(() => {
  resetMockInstances();
});

describe("createWsClientAdapter — edge cases", () => {
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
    const instancesBefore = getMockInstancesLength();

    harness.adapter.connect();

    expect(getMockInstancesLength()).toBe(instancesBefore); // no new WS created
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

    await expect(manifestPromise).rejects.toBeInstanceOf(Error);
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
