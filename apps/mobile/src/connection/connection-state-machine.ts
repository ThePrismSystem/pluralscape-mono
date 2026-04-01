import type {
  ConnectionConfig,
  ConnectionEvent,
  ConnectionListener,
  ConnectionState,
} from "./connection-types.js";

const DEFAULT_BASE_BACKOFF_MS = 1_000;
const DEFAULT_MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

/**
 * Pure, framework-agnostic connection state machine.
 *
 * The snapshot returned by `getSnapshot()` is referentially stable between
 * dispatches — a new value is only created when `dispatch()` changes state.
 * This satisfies the `useSyncExternalStore` contract.
 */
export class ConnectionStateMachine {
  private state: ConnectionState = "disconnected";
  private cachedSnapshot: ConnectionState = this.state;
  private readonly listeners = new Set<ConnectionListener>();
  private retryCount = 0;
  private readonly config: ConnectionConfig;

  constructor(config: Partial<ConnectionConfig> & Pick<ConnectionConfig, "baseUrl">) {
    this.config = {
      baseUrl: config.baseUrl,
      baseBackoffMs: config.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS,
      maxBackoffMs: config.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS,
    };
  }

  getSnapshot(): ConnectionState {
    return this.cachedSnapshot;
  }

  subscribe(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Returns the current exponential backoff delay in milliseconds,
   * capped at maxBackoffMs.
   */
  getBackoffMs(): number {
    const delay = this.config.baseBackoffMs * Math.pow(BACKOFF_MULTIPLIER, this.retryCount);
    return Math.min(delay, this.config.maxBackoffMs);
  }

  dispatch(event: ConnectionEvent): void {
    const prev = this.state;

    switch (event.type) {
      case "CONNECT":
        if (prev === "disconnected") {
          this.state = "connecting";
          this.retryCount = 0;
        }
        break;

      case "CONNECTED":
        if (prev === "connecting" || prev === "reconnecting") {
          this.state = "connected";
          this.retryCount = 0;
        }
        break;

      case "DISCONNECT":
        this.state = "disconnected";
        this.retryCount = 0;
        break;

      case "CONNECTION_LOST":
        if (prev === "connected" || prev === "reconnecting") {
          this.state = "reconnecting";
          this.retryCount++;
        } else if (prev === "connecting") {
          this.state = "backoff";
          this.retryCount++;
        }
        break;

      case "BACKOFF_COMPLETE":
        if (prev === "backoff") {
          this.state = "reconnecting";
        }
        break;

      case "RETRY":
        if (prev === "reconnecting") {
          this.state = "connecting";
        }
        break;
    }

    if (this.state !== prev) {
      this.cachedSnapshot = this.state;
      for (const listener of this.listeners) {
        listener(this.cachedSnapshot);
      }
    }
  }
}
