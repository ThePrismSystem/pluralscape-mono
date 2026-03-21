/**
 * Valkey pub/sub adapter for cross-instance WebSocket fan-out.
 *
 * Uses two ioredis connections: one dedicated to subscriptions (ioredis
 * requirement — subscriber connections cannot issue other commands) and
 * one for publishing.
 *
 * On reconnect, automatically resubscribes to all active channels since
 * Valkey drops subscriptions when the connection is lost.
 *
 * Security: Valkey pub/sub messages are trusted — they travel over the
 * internal network between the API server and Valkey. No authentication
 * or integrity layer is applied to individual messages. If the deployment
 * boundary changes (e.g. Valkey exposed to untrusted networks), message
 * signing should be added.
 */
import { WS_VALKEY_CONNECT_TIMEOUT_MS } from "./ws.constants.js";
import { formatError } from "./ws.utils.js";

import type { Logger } from "@pluralscape/types";

/** Logger interface for pub/sub — extends base Logger with debug level. */
export type PubSubLogger = Logger & {
  debug(msg: string, obj?: Record<string, unknown>): void;
};

/** Minimal ioredis-compatible interface for pub/sub operations. */
export interface PubSubClient {
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  publish(channel: string, message: string): Promise<number>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  disconnect(): Promise<void>;
  status: string;
}

/** Factory function that creates a PubSubClient from a URL. */
export type PubSubClientFactory = (url: string, opts: Record<string, unknown>) => PubSubClient;

/**
 * Valkey pub/sub adapter for cross-instance message delivery.
 *
 * Gracefully degrades: if Valkey is unavailable, all methods are no-ops
 * and local-only delivery continues to work.
 */
export class ValkeyPubSub {
  private subscriber: PubSubClient | null = null;
  private publisher: PubSubClient | null = null;
  private readonly handlers = new Map<string, Set<(message: string) => void>>();
  private readonly activeChannels = new Set<string>();
  private readonly serverId: string;
  private readonly logger: PubSubLogger;

  constructor(serverId: string, logger: PubSubLogger) {
    this.serverId = serverId;
    this.logger = logger;
  }

  /**
   * Connect to Valkey using the provided URL. Returns false if connection fails.
   *
   * Accepts an optional factory for testing — production code omits it
   * and ioredis is loaded via dynamic import.
   */
  async connect(url: string, factory?: PubSubClientFactory): Promise<boolean> {
    try {
      let createClient: PubSubClientFactory;
      if (factory) {
        createClient = factory;
      } else {
        const moduleName = "ioredis";
        const mod = (await import(moduleName)) as {
          default: new (url: string, opts: Record<string, unknown>) => PubSubClient;
        };
        createClient = (u, opts) => new mod.default(u, opts);
      }

      this.subscriber = createClient(url, {
        maxRetriesPerRequest: null,
        lazyConnect: false,
        connectTimeout: WS_VALKEY_CONNECT_TIMEOUT_MS,
      });
      this.publisher = createClient(url, {
        maxRetriesPerRequest: null,
        lazyConnect: false,
        connectTimeout: WS_VALKEY_CONNECT_TIMEOUT_MS,
      });

      // Prevent unhandled 'error' events from crashing the process
      this.subscriber.on("error", (err: unknown) => {
        this.logger.warn("Valkey subscriber error", { error: formatError(err) });
      });
      this.publisher.on("error", (err: unknown) => {
        this.logger.warn("Valkey publisher error", { error: formatError(err) });
      });

      // Wire up message delivery
      this.subscriber.on("message", (channel: unknown, message: unknown) => {
        if (typeof channel !== "string" || typeof message !== "string") return;
        const channelHandlers = this.handlers.get(channel);
        if (!channelHandlers) return;
        for (const handler of channelHandlers) {
          try {
            handler(message);
          } catch (err) {
            this.logger.error("Valkey pub/sub handler error", {
              channel,
              error: formatError(err),
            });
          }
        }
      });

      // Auto-resubscribe on reconnect (Valkey drops subscriptions on disconnect)
      this.subscriber.on("ready", () => {
        void this.resubscribeAll();
      });

      this.logger.info("Valkey pub/sub connected", { serverId: this.serverId });
      return true;
    } catch (err) {
      this.logger.warn("Failed to connect Valkey pub/sub, using local-only delivery", {
        error: formatError(err),
      });
      this.subscriber = null;
      this.publisher = null;
      return false;
    }
  }

  /** Publish a message to a channel. Returns false if no publisher or publish failed. */
  async publish(channel: string, message: string): Promise<boolean> {
    if (!this.publisher) return false;
    try {
      await this.publisher.publish(channel, message);
      return true;
    } catch (err) {
      this.logger.warn("Valkey publish failed", {
        channel,
        error: formatError(err),
      });
      return false;
    }
  }

  /** Subscribe to a channel with a handler. Returns the outcome. */
  async subscribe(
    channel: string,
    handler: (message: string) => void,
  ): Promise<"subscribed" | "deferred" | "failed"> {
    let channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) {
      channelHandlers = new Set();
      this.handlers.set(channel, channelHandlers);
    }
    channelHandlers.add(handler);

    if (!this.activeChannels.has(channel)) {
      if (this.subscriber) {
        try {
          await this.subscriber.subscribe(channel);
          this.activeChannels.add(channel);
        } catch (err) {
          // I8: Remove the handler we just added on subscribe failure
          channelHandlers.delete(handler);
          if (channelHandlers.size === 0) {
            this.handlers.delete(channel);
          }
          this.logger.warn("Valkey subscribe failed", {
            channel,
            error: formatError(err),
          });
          return "failed";
        }
      } else {
        // No subscriber — track for reconnect
        this.activeChannels.add(channel);
        return "deferred";
      }
    }

    return "subscribed";
  }

  /** Unsubscribe from a channel. Removes the handler; unsubscribes from Valkey when no handlers remain. */
  async unsubscribe(channel: string, handler?: (message: string) => void): Promise<void> {
    const channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) return;

    if (handler) {
      channelHandlers.delete(handler);
    } else {
      channelHandlers.clear();
    }

    if (channelHandlers.size === 0) {
      this.handlers.delete(channel);
      if (this.subscriber) {
        try {
          await this.subscriber.unsubscribe(channel);
          this.activeChannels.delete(channel);
        } catch (err) {
          // Leave activeChannels intact so reconnect logic can retry
          this.logger.warn("Valkey unsubscribe failed", {
            channel,
            error: formatError(err),
          });
        }
      } else {
        this.activeChannels.delete(channel);
      }
    }
  }

  /** L9: Resubscribe to all active channels after reconnection. */
  private async resubscribeAll(): Promise<void> {
    if (this.activeChannels.size === 0) return;

    const channels = [...this.activeChannels];
    this.logger.info("Valkey subscriber reconnected, resubscribing", {
      channels: channels.length,
    });

    try {
      const results = await Promise.allSettled(
        channels.map(async (channel) => {
          await this.subscriber?.subscribe(channel);
        }),
      );

      let succeeded = 0;
      let failed = 0;
      for (const result of results) {
        if (result.status === "fulfilled") {
          succeeded++;
        } else {
          failed++;
          // Do NOT delete from activeChannels — next reconnect will retry
          this.logger.warn("Valkey resubscribe failed for channel", {
            error: formatError(result.reason),
          });
        }
      }
      this.logger.info("Valkey resubscription complete", { succeeded, failed });
    } catch (err: unknown) {
      // I9: Catch errors from the processing itself
      this.logger.error("Valkey resubscription processing error", {
        error: formatError(err),
      });
    }
  }

  /** Disconnect both pub and sub connections. */
  async disconnect(): Promise<void> {
    this.handlers.clear();
    this.activeChannels.clear();
    try {
      if (this.subscriber) await this.subscriber.disconnect();
    } catch (err) {
      this.logger.debug("Valkey subscriber already disconnected", {
        error: formatError(err),
      });
    }
    try {
      if (this.publisher) await this.publisher.disconnect();
    } catch (err) {
      this.logger.debug("Valkey publisher already disconnected", {
        error: formatError(err),
      });
    }
    this.subscriber = null;
    this.publisher = null;
  }

  /** The server ID for deduplication (skip self-published messages). */
  get id(): string {
    return this.serverId;
  }

  /** Whether Valkey is connected and ready. */
  get connected(): boolean {
    return (
      this.subscriber !== null &&
      this.publisher !== null &&
      this.subscriber.status === "ready" &&
      this.publisher.status === "ready"
    );
  }
}
