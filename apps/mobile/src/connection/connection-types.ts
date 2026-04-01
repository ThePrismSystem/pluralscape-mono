import type { SystemId } from "@pluralscape/types";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "backoff"
  | "reconnecting";

export interface ConnectionConfig {
  readonly baseUrl: string;
  readonly maxBackoffMs: number; // default 30_000
  readonly baseBackoffMs: number; // default 1_000
}

export type ConnectionEvent =
  | { type: "CONNECT"; token: string; systemId: SystemId }
  | { type: "CONNECTED" }
  | { type: "DISCONNECT" }
  | { type: "CONNECTION_LOST" }
  | { type: "RETRY" }
  | { type: "BACKOFF_COMPLETE" };

export type ConnectionListener = (state: ConnectionState) => void;

/** Parsed SSE event — only valid JSON reaches listeners. */
export type SseEvent = { readonly type: "message"; readonly data: unknown };

/** Lifecycle callbacks for SSE connection state changes. */
export interface SseLifecycleCallbacks {
  onConnected(): void;
  onDisconnected(): void;
  onError(err: unknown): void;
}

export type SseEventListener = (event: SseEvent) => void;
