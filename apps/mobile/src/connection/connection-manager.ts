import { ConnectionStateMachine } from "./connection-state-machine.js";
import { SseClient } from "./sse-client.js";

import type { ConnectionConfig, ConnectionState } from "./connection-types.js";
import type { AuthStateSnapshot } from "../auth/auth-types.js";
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

  constructor(config: ConnectionManagerConfig) {
    const machineConfig: ConnectionConfig = {
      baseUrl: config.baseUrl,
      baseBackoffMs: config.baseBackoffMs ?? 1_000,
      maxBackoffMs: config.maxBackoffMs ?? 30_000,
    };
    this.stateMachine = new ConnectionStateMachine(machineConfig);
    this.sseClient = new SseClient(
      { baseUrl: config.baseUrl },
      {
        onConnected: () => {
          this.stateMachine.dispatch({ type: "CONNECTED" });
        },
        onDisconnected: () => {
          this.handleConnectionLost();
        },
        onError: () => {
          this.handleConnectionLost();
        },
      },
    );
  }

  getSnapshot(): ConnectionState {
    return this.stateMachine.getSnapshot();
  }

  subscribe(listener: (state: ConnectionState) => void): () => void {
    return this.stateMachine.subscribe(listener);
  }

  onAuthStateChange(snapshot: AuthStateSnapshot): void {
    if (snapshot.state === "unlocked") {
      const { sessionToken, systemId } = snapshot.credentials;
      this.connect(sessionToken, systemId);
    } else {
      this.disconnect();
    }
  }

  private connect(token: string, systemId: SystemId): void {
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
        if (state === "backoff") {
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
