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
  | { type: "CONNECT"; token: string; systemId: string }
  | { type: "CONNECTED" }
  | { type: "DISCONNECT" }
  | { type: "CONNECTION_LOST" }
  | { type: "RETRY" }
  | { type: "BACKOFF_COMPLETE" };

export type ConnectionListener = (state: ConnectionState) => void;
