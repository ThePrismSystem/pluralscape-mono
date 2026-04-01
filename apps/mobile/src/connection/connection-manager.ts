import { ConnectionStateMachine } from "./connection-state-machine.js";
import { SseClient } from "./sse-client.js";

import type { ConnectionConfig, ConnectionState } from "./connection-types.js";
import type { AuthStateSnapshot } from "../auth/auth-types.js";

export interface ConnectionManagerConfig {
  readonly baseUrl: string;
  readonly maxBackoffMs?: number;
  readonly baseBackoffMs?: number;
}

/**
 * Owns both the WebSocket and SSE connections.
 * Responds to auth state changes: connects on UNLOCKED, disconnects on LOCKED/UNAUTHENTICATED.
 */
export class ConnectionManager {
  private readonly stateMachine: ConnectionStateMachine;
  private readonly sseClient: SseClient;
  private backoffTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: ConnectionManagerConfig) {
    const machineConfig: ConnectionConfig = {
      baseUrl: config.baseUrl,
      baseBackoffMs: config.baseBackoffMs ?? 1_000,
      maxBackoffMs: config.maxBackoffMs ?? 30_000,
    };
    this.stateMachine = new ConnectionStateMachine(machineConfig);
    this.sseClient = new SseClient({ baseUrl: config.baseUrl });
  }

  getSnapshot(): ConnectionState {
    return this.stateMachine.getSnapshot();
  }

  subscribe(listener: (state: ConnectionState) => void): () => void {
    return this.stateMachine.subscribe(listener);
  }

  onAuthStateChange(snapshot: AuthStateSnapshot): void {
    if (snapshot.state === "unlocked" && snapshot.credentials !== null) {
      const { sessionToken, systemId } = snapshot.credentials;
      this.connect(sessionToken, systemId);
    } else {
      this.disconnect();
    }
  }

  private connect(token: string, systemId: string): void {
    this.stateMachine.dispatch({ type: "CONNECT", token, systemId });
    this.sseClient.connect(token);
    this.stateMachine.dispatch({ type: "CONNECTED" });
  }

  disconnect(): void {
    this.clearBackoffTimer();
    this.sseClient.disconnect();
    this.stateMachine.dispatch({ type: "DISCONNECT" });
  }

  private clearBackoffTimer(): void {
    if (this.backoffTimer !== null) {
      clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }
  }

  handleConnectionLost(): void {
    this.sseClient.disconnect();
    this.stateMachine.dispatch({ type: "CONNECTION_LOST" });

    const state = this.stateMachine.getSnapshot();
    if (state === "backoff") {
      const delayMs = this.stateMachine.getBackoffMs();
      this.backoffTimer = setTimeout(() => {
        this.backoffTimer = null;
        this.stateMachine.dispatch({ type: "BACKOFF_COMPLETE" });
      }, delayMs);
    }
  }
}
