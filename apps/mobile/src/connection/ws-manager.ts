import { createWsClientAdapter } from "@pluralscape/sync/adapters";

import type { DataLayerEventMap, EventBus } from "@pluralscape/sync";
import type { WsClientAdapter } from "@pluralscape/sync/adapters";
import type { SystemId } from "@pluralscape/types";

// ── Constants ─────────────────────────────────────────────────────────

const DEFAULT_BASE_BACKOFF_MS = 1_000;
const DEFAULT_MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;
const JITTER_MIN = 0.75;
const JITTER_MAX = 1.25;

// ── Types ─────────────────────────────────────────────────────────────

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "backoff"
  | "reconnecting";

export interface WsManagerConfig {
  readonly url: string;
  readonly eventBus: EventBus<DataLayerEventMap>;
  readonly baseBackoffMs?: number;
  readonly maxBackoffMs?: number;
}

export interface WsManager {
  connect(token: string, systemId: SystemId): void;
  disconnect(): void;
  /** For useSyncExternalStore — returns current status. */
  getSnapshot(): ConnectionStatus;
  /** For useSyncExternalStore — returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Returns the underlying WsClientAdapter, or null if not connected. */
  getAdapter(): WsClientAdapter | null;
}

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Creates a mobile-lifecycle-aware WebSocket manager.
 *
 * Wraps {@link createWsClientAdapter} with:
 * - Status tracking compatible with React's `useSyncExternalStore`
 * - Jittered exponential backoff reconnection on unexpected disconnects
 * - Intentional-disconnect guard to suppress automatic reconnect
 */
export function createWsManager(config: WsManagerConfig): WsManager {
  const baseBackoffMs = config.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
  const maxBackoffMs = config.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;

  let status: ConnectionStatus = "disconnected";
  let adapter: WsClientAdapter | null = null;
  let intentionalDisconnect = false;
  let retryCount = 0;
  let backoffTimer: ReturnType<typeof setTimeout> | null = null;
  let lastToken: string | null = null;
  let lastSystemId: SystemId | null = null;

  const listeners = new Set<() => void>();

  // Active event bus unsubscribers
  let unsubConnected: (() => void) | null = null;
  let unsubDisconnected: (() => void) | null = null;

  function setStatus(next: ConnectionStatus): void {
    if (next === status) return;
    status = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function clearBackoffTimer(): void {
    if (backoffTimer !== null) {
      clearTimeout(backoffTimer);
      backoffTimer = null;
    }
  }

  function getJitteredDelay(retry: number): number {
    const base = baseBackoffMs * Math.pow(BACKOFF_MULTIPLIER, retry);
    const capped = Math.min(base, maxBackoffMs);
    const jitter = JITTER_MIN + Math.random() * (JITTER_MAX - JITTER_MIN);
    return Math.round(capped * jitter);
  }

  function unbindEventBus(): void {
    unsubConnected?.();
    unsubConnected = null;
    unsubDisconnected?.();
    unsubDisconnected = null;
  }

  function bindEventBus(): void {
    unbindEventBus();

    unsubConnected = config.eventBus.on("ws:connected", () => {
      retryCount = 0;
      setStatus("connected");
    });

    unsubDisconnected = config.eventBus.on("ws:disconnected", () => {
      if (intentionalDisconnect) return;
      if (status === "disconnected") return;

      clearBackoffTimer();
      setStatus("backoff");

      const delay = getJitteredDelay(retryCount);
      retryCount++;

      backoffTimer = setTimeout(() => {
        backoffTimer = null;
        if (intentionalDisconnect || status === "disconnected") return;
        setStatus("reconnecting");
        reconnect();
      }, delay);
    });
  }

  function reconnect(): void {
    if (lastToken === null || lastSystemId === null) return;

    if (adapter !== null) {
      adapter.disconnect();
      adapter = null;
    }

    adapter = createWsClientAdapter({
      url: config.url,
      token: lastToken,
      systemId: lastSystemId,
      eventBus: config.eventBus,
    });
    adapter.connect();
  }

  return {
    connect(token: string, systemId: SystemId): void {
      intentionalDisconnect = false;
      lastToken = token;
      lastSystemId = systemId;

      adapter = createWsClientAdapter({
        url: config.url,
        token,
        systemId,
        eventBus: config.eventBus,
      });

      bindEventBus();
      setStatus("connecting");
      adapter.connect();
    },

    disconnect(): void {
      intentionalDisconnect = true;
      clearBackoffTimer();
      unbindEventBus();

      if (adapter !== null) {
        adapter.disconnect();
        adapter = null;
      }

      setStatus("disconnected");
    },

    getSnapshot(): ConnectionStatus {
      return status;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getAdapter(): WsClientAdapter | null {
      return adapter;
    },
  };
}
