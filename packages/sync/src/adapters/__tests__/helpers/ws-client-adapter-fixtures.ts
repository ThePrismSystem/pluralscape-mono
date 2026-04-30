import { brandId } from "@pluralscape/types";

import { createEventBus } from "../../../event-bus/event-bus.js";
import { createWsClientAdapter } from "../../ws-client-adapter.js";

import type { EventBus } from "../../../event-bus/event-bus.js";
import type { DataLayerEventMap } from "../../../event-bus/event-map.js";
import type {
  MinimalWebSocket,
  WsClientAdapter,
  WsClientAdapterConfig,
} from "../../ws-client-adapter.js";
import type { SyncDocumentId, SystemId } from "@pluralscape/types";

/**
 * Shared fixtures for ws-client-adapter test files.
 *
 * Each test file calls `setupHarness()` to initialize a fresh tracker, then
 * calls `createTestHarness()` per test to build a new adapter and bus.
 * Files must call `resetMockInstances()` from `afterEach` to keep state
 * clean (the harness module's `mockInstances` array is per-file).
 */

export function asSyncDocId(id: string): SyncDocumentId {
  return brandId<SyncDocumentId>(id);
}

export function asSystemId(id: string): SystemId {
  return brandId<SystemId>(id);
}

// ── MockWebSocket ───────────────────────────────────────────────────

/**
 * Tracks all MockWebSocket instances created during tests.
 *
 * Each test file imports its own copy of this array (since this module
 * has no shared mutable state across files). Within a single file, all
 * MockWebSocket constructions push into the same array via `MockWebSocket`.
 */
let mockInstances: MockWebSocket[] = [];

export class MockWebSocket implements MinimalWebSocket {
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

/** Resets the per-file mockInstances tracker. Call from `afterEach`. */
export function resetMockInstances(): void {
  mockInstances = [];
}

/** Returns the most recently created MockWebSocket. Throws if none exist. */
export function getLastMock(): MockWebSocket {
  const mock = mockInstances[mockInstances.length - 1];
  if (!mock) throw new Error("No MockWebSocket instances created");
  return mock;
}

/** Direct accessor used by `connect() is a no-op when already disposed`. */
export function getMockInstancesLength(): number {
  return mockInstances.length;
}

// ── Test harness ──────────────────────────────────────────────────────

export interface TestHarness {
  adapter: WsClientAdapter;
  eventBus: EventBus<DataLayerEventMap>;
  /** Connects, opens, and completes the auth handshake. Returns the mock WS. */
  connectAndAuth(): MockWebSocket;
}

export function createTestHarness(): TestHarness {
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
