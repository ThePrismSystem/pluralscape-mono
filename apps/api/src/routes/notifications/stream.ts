/**
 * SSE notification stream endpoint.
 *
 * GET /v1/notifications/stream
 * - Requires session auth
 * - Subscribes to Valkey ps:notify:{accountId} channel
 * - Replays missed events from ring buffer on reconnect (Last-Event-ID)
 * - Sends heartbeat comments every 30s to prevent proxy timeouts
 * - Single Valkey subscription per account (shared across tabs)
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { HTTP_TOO_MANY_REQUESTS } from "../../http.constants.js";
import { logger } from "../../lib/logger.js";
import { getNotificationPubSub } from "../../lib/notification-pubsub.js";
import { SseEventBuffer } from "../../lib/sse-manager.js";
import {
  SSE_CHANNEL_PREFIX,
  SSE_HEARTBEAT_INTERVAL_MS,
  SSE_MAX_CONNECTIONS_PER_ACCOUNT,
} from "../../lib/sse.constants.js";
import { authMiddleware } from "../../middleware/auth.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";

import type { AuthEnv } from "../../lib/auth-context.js";
import type { SSEStreamingApi } from "hono/streaming";

export const notificationsRoutes = new Hono<AuthEnv>();

notificationsRoutes.use("*", createCategoryRateLimiter("sseStream"));
notificationsRoutes.use("*", authMiddleware());

/** Per-account SSE state: shared buffer, set of connected streams, Valkey handler. */
interface AccountSseState {
  buffer: SseEventBuffer;
  streams: Set<SSEStreamingApi>;
  messageHandler: ((message: string) => void) | null;
}

/** Per-account SSE state management. */
const sseState = {
  states: new Map<string, AccountSseState>(),
  noPubSubWarningLogged: false,
  getOrCreate(accountId: string): AccountSseState {
    let state = this.states.get(accountId);
    if (!state) {
      state = { buffer: new SseEventBuffer(), streams: new Set(), messageHandler: null };
      this.states.set(accountId, state);
    }
    return state;
  },
  get(accountId: string): AccountSseState | undefined {
    return this.states.get(accountId);
  },
  delete(accountId: string): void {
    this.states.delete(accountId);
  },
  reset(): void {
    this.states.clear();
    this.noPubSubWarningLogged = false;
  },
};

notificationsRoutes.get("/stream", (c) => {
  const auth = c.get("auth");
  const accountId = auth.accountId;
  const lastEventId = c.req.header("Last-Event-ID");
  // M1: Enforce per-account SSE connection limit
  const existingStreams = sseState.get(accountId)?.streams.size ?? 0;
  if (existingStreams >= SSE_MAX_CONNECTIONS_PER_ACCOUNT) {
    return c.json(
      {
        error: "TOO_MANY_STREAMS",
        message: `Maximum of ${String(SSE_MAX_CONNECTIONS_PER_ACCOUNT)} concurrent SSE connections per account exceeded`,
      },
      HTTP_TOO_MANY_REQUESTS,
    );
  }

  const state = sseState.getOrCreate(accountId);
  const pubsub = getNotificationPubSub();
  const channel = `${SSE_CHANNEL_PREFIX}${accountId}`;

  return streamSSE(c, async (stream) => {
    // Register this stream
    state.streams.add(stream);

    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

    try {
      // Send an immediate heartbeat to flush response headers to the client.
      // Without this, Bun buffers the headers until the first write, causing
      // SSE clients to hang until the first periodic heartbeat (30s).
      await stream.write(": heartbeat\n\n");

      // Replay missed events if reconnecting with Last-Event-ID
      if (lastEventId) {
        const missed = state.buffer.since(lastEventId);
        if (missed === null) {
          // Gap detected — client must full sync
          await stream.writeSSE({
            event: "full-sync",
            data: JSON.stringify({ reason: "replay-window-exceeded" }),
            id: String(state.buffer.lastAssignedId),
          });
        } else {
          for (const event of missed) {
            await stream.writeSSE({
              event: event.event,
              data: event.data,
              id: event.id,
            });
          }
        }
      }

      // Heartbeat timer
      heartbeatTimer = setInterval(() => {
        void stream.write(": heartbeat\n\n").catch(() => {
          // Stream closed — timer will be cleared in cleanup
        });
      }, SSE_HEARTBEAT_INTERVAL_MS);

      // Subscribe to Valkey channel — only once per account (first stream)
      if (pubsub && !state.messageHandler) {
        const handler = (message: string): void => {
          let parsed: { event?: string; data?: unknown };
          try {
            parsed = JSON.parse(message) as { event?: string; data?: unknown };
          } catch {
            logger.warn("SSE: malformed Valkey message", { channel });
            return;
          }

          const eventType = typeof parsed.event === "string" ? parsed.event : "notification";
          const data = JSON.stringify(parsed.data ?? parsed);
          const id = state.buffer.push(eventType, data);

          // Fan out to all connected streams for this account
          for (const s of state.streams) {
            void s.writeSSE({ event: eventType, data, id }).catch(() => {
              // Stream closed — will be cleaned up
            });
          }
        };

        state.messageHandler = handler;
        await pubsub.subscribe(channel, handler);
      }

      if (!pubsub && !sseState.noPubSubWarningLogged) {
        logger.warn("SSE: no pub/sub configured, stream will only receive heartbeats");
        sseState.noPubSubWarningLogged = true;
      }

      // Wait for the stream to close (client disconnect)
      if (!stream.aborted) {
        await new Promise<void>((resolve) => {
          stream.onAbort(() => {
            resolve();
          });
        });
      }
    } finally {
      // Cleanup
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      state.streams.delete(stream);

      // If no more streams for this account, unsubscribe and clean up
      if (state.streams.size === 0) {
        if (pubsub && state.messageHandler) {
          await pubsub.unsubscribe(channel, state.messageHandler);
        }
        sseState.delete(accountId);
      }
    }
  });
});

/** Get the number of active SSE streams for an account. */
export function getAccountSseStreamCount(accountId: string): number {
  return sseState.get(accountId)?.streams.size ?? 0;
}

/** Reset SSE state (for testing). */
export function _resetSseStateForTesting(): void {
  sseState.reset();
}

/** Add a mock stream entry for testing connection limits (does not create a real stream). */
export function _addMockStreamForTesting(accountId: string): void {
  const state = sseState.getOrCreate(accountId);
  // Use a unique object as a stand-in for a real SSEStreamingApi
  state.streams.add({} as SSEStreamingApi);
}
