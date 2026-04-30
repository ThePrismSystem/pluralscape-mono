import { afterEach, describe, expect, it, vi } from "vitest";

import { SYNC_PROTOCOL_VERSION } from "../../protocol.js";

import {
  asSystemId,
  createTestHarness,
  getLastMock,
  resetMockInstances,
} from "./helpers/ws-client-adapter-fixtures.js";

import type { WsDisconnectedEvent, WsNotificationEvent } from "../../event-bus/event-map.js";

afterEach(() => {
  resetMockInstances();
});

describe("createWsClientAdapter — auth handshake", () => {
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
      const req = mock.sentMessages.find((m) => (m as { type: string }).type === "ManifestRequest");
      expect(req).not.toBeUndefined();
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

describe("createWsClientAdapter — disconnect and lifecycle", () => {
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

describe("createWsClientAdapter — notification demux", () => {
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
