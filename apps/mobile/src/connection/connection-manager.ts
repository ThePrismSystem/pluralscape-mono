import { ConnectionStateMachine } from "./connection-state-machine.js";
import { SseClient } from "./sse-client.js";

import type { ConnectionState } from "./connection-types.js";
import type { SystemId } from "@pluralscape/types";

export interface ConnectionManagerConfig {
  readonly baseUrl: string;
  readonly maxBackoffMs?: number;
  readonly baseBackoffMs?: number;
}

export class ConnectionManager {
  private readonly stateMachine: ConnectionStateMachine;
  private readonly sseClient: SseClient;
  private backoffTimer: ReturnType<typeof setTimeout> | null = null;
  private lastToken: string | null = null;
  private lastSystemId: SystemId | null = null;
  private lastError: unknown = null;

  constructor(config: ConnectionManagerConfig) {
    this.stateMachine = new ConnectionStateMachine(config);
    this.sseClient = new SseClient(
      { baseUrl: config.baseUrl },
      {
        onConnected: () => {
          this.lastError = null;
          this.stateMachine.dispatch({ type: "CONNECTED" });
        },
        onDisconnected: () => {
          this.handleConnectionLost();
        },
        onError: (err: unknown) => {
          this.lastError = err;
          this.handleConnectionLost();
        },
      },
    );
  }

  getSnapshot(): ConnectionState {
    return this.stateMachine.getSnapshot();
  }

  getLastError(): unknown {
    return this.lastError;
  }

  subscribe(listener: (state: ConnectionState) => void): () => void {
    return this.stateMachine.subscribe(listener);
  }

  connect(token: string, systemId: SystemId): void {
    if (this.stateMachine.getSnapshot() !== "disconnected") return;
    this.lastToken = token;
    this.lastSystemId = systemId;
    this.stateMachine.dispatch({ type: "CONNECT", token, systemId });
    this.sseClient.connect(token);
  }

  disconnect(): void {
    this.clearBackoffTimer();
    this.sseClient.disconnect();
    this.stateMachine.dispatch({ type: "DISCONNECT" });
    this.lastToken = null;
    this.lastSystemId = null;
    this.lastError = null;
  }

  private clearBackoffTimer(): void {
    if (this.backoffTimer !== null) {
      clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }
  }

  private handleConnectionLost(): void {
    this.sseClient.disconnect();
    this.stateMachine.dispatch({ type: "CONNECTION_LOST" });

    const state = this.stateMachine.getSnapshot();
    if (state === "backoff" || state === "reconnecting") {
      const delayMs = this.stateMachine.getBackoffMs();
      this.backoffTimer = setTimeout(() => {
        this.backoffTimer = null;
        // Re-read state — may have changed during backoff (e.g., explicit disconnect)
        const currentState = this.stateMachine.getSnapshot();
        if (currentState === "disconnected") return;
        if (currentState === "backoff") {
          this.stateMachine.dispatch({ type: "BACKOFF_COMPLETE" });
        }
        this.reconnect();
      }, delayMs);
    }
  }

  private reconnect(): void {
    if (this.lastToken === null || this.lastSystemId === null) return;
    this.stateMachine.dispatch({ type: "RETRY" });
    this.sseClient.connect(this.lastToken);
  }
}
