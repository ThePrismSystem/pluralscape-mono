import { fetchEventSource } from "@microsoft/fetch-event-source";

export type SseEventListener = (event: unknown) => void;

export interface SseClientConfig {
  readonly baseUrl: string;
}

const NOTIFICATIONS_PATH = "/api/v1/notifications/stream";

export class SseClient {
  private readonly config: SseClientConfig;
  private abortController: AbortController | null = null;
  private lastEventId: string | null = null;
  private readonly listeners = new Set<SseEventListener>();
  private connected = false;

  constructor(config: SseClientConfig) {
    this.config = config;
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
          parsed = ev.data;
        }
        for (const listener of this.listeners) {
          listener(parsed);
        }
      },
      onclose: () => {
        this.connected = false;
        this.abortController = null;
      },
      onerror: () => {
        this.connected = false;
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
