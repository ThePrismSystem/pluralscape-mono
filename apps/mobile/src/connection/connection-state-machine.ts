import { DEFAULT_BASE_BACKOFF_MS, DEFAULT_MAX_BACKOFF_MS } from "./connection-types.js";

import type {
  ConnectionConfig,
  ConnectionEvent,
  ConnectionListener,
  ConnectionState,
} from "./connection-types.js";

const BACKOFF_MULTIPLIER = 2;
const JITTER_MIN = 0.75;
const JITTER_MAX = 1.25;

/**
 * Pure, framework-agnostic connection state machine.
 *
 * The snapshot returned by `getSnapshot()` is referentially stable between
 * dispatches — a new value is only created when `dispatch()` changes state.
 * This satisfies the `useSyncExternalStore` contract.
 */
export class ConnectionStateMachine {
  private state: ConnectionState = "disconnected";
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
    return this.state;
  }

  subscribe(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Returns the current exponential backoff delay in milliseconds
   * with ±25% jitter, hard-capped at maxBackoffMs.
   */
  getBackoffMs(): number {
    const delay = this.config.baseBackoffMs * Math.pow(BACKOFF_MULTIPLIER, this.retryCount);
    const jitter = JITTER_MIN + Math.random() * (JITTER_MAX - JITTER_MIN);
    return Math.round(Math.min(delay * jitter, this.config.maxBackoffMs));
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

      default: {
        const _exhaustive: never = event;
        throw new Error(`Unhandled event: ${(_exhaustive as ConnectionEvent).type}`);
      }
    }

    if (this.state !== prev) {
      for (const listener of this.listeners) {
        listener(this.state);
      }
    }
  }
}
