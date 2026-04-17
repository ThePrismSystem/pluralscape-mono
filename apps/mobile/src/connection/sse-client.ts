import { fetchEventSource } from "@microsoft/fetch-event-source";

import type { SseEventListener, SseLifecycleCallbacks } from "./connection-types.js";

export interface SseClientConfig {
  readonly baseUrl: string;
}

const NOTIFICATIONS_PATH = "/api/v1/notifications/stream";

export class SseClient {
  private readonly config: SseClientConfig;
  private readonly callbacks: SseLifecycleCallbacks;
  private abortController: AbortController | null = null;
  private lastEventId: string | null = null;
  private readonly listeners = new Set<SseEventListener>();
  private connected = false;

  constructor(config: SseClientConfig, callbacks: SseLifecycleCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  connect(token: string): void {
    if (this.abortController !== null) {
      return;
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (this.lastEventId !== null) {
      headers["Last-Event-ID"] = this.lastEventId;
    }

    void fetchEventSource(`${this.config.baseUrl}${NOTIFICATIONS_PATH}`, {
      headers,
      signal,
      onopen: (): Promise<void> => {
        this.connected = true;
        this.callbacks.onConnected();
        return Promise.resolve();
      },
      onmessage: (ev) => {
        if (ev.id) {
          this.lastEventId = ev.id;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(ev.data) as unknown;
        } catch {
          // Deliberately omit the raw payload — it may contain server-side
          // secrets, PII, or attacker-controlled content. The length alone is
          // a non-sensitive diagnostic signal and meaningfully improves field
          // support triage of malformed-frame bugs.
          const length = typeof ev.data === "string" ? ev.data.length : -1;
          this.callbacks.onError(new Error(`Malformed SSE JSON payload (len=${String(length)})`));
          return;
        }
        const event = { type: "message" as const, data: parsed };
        for (const listener of this.listeners) {
          listener(event);
        }
      },
      onclose: () => {
        this.connected = false;
        this.abortController = null;
        this.callbacks.onDisconnected();
      },
      onerror: (err: unknown) => {
        this.disconnect();
        const error = err instanceof Error ? err : new Error(String(err));
        this.callbacks.onError(error);
        throw error;
      },
    });
  }

  disconnect(): void {
    if (this.abortController !== null) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.connected = false;
  }

  onEvent(listener: SseEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get isConnected(): boolean {
    return this.connected;
  }
}
