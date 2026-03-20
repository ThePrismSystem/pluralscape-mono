/**
 * SSE notification stream endpoint.
 *
 * GET /v1/notifications/stream
 * - Requires session auth
 * - Subscribes to Valkey ps:notify:{accountId} channel
 * - Replays missed events from ring buffer on reconnect (Last-Event-ID)
 * - Sends heartbeat comments every 30s to prevent proxy timeouts
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { getNotificationPubSub } from "../../lib/notification-pubsub.js";
import { SseEventBuffer } from "../../lib/sse-manager.js";
import { SSE_CHANNEL_PREFIX, SSE_HEARTBEAT_INTERVAL_MS } from "../../lib/sse.constants.js";
import { authMiddleware } from "../../middleware/auth.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";

import type { AuthEnv } from "../../lib/auth-context.js";

export const notificationsRoutes = new Hono<AuthEnv>();

notificationsRoutes.use("*", createCategoryRateLimiter("readDefault"));
notificationsRoutes.use("*", authMiddleware());

/** Per-account event buffers for replay on reconnect. */
const accountBuffers = new Map<string, SseEventBuffer>();

function getOrCreateBuffer(accountId: string): SseEventBuffer {
  let buffer = accountBuffers.get(accountId);
  if (!buffer) {
    buffer = new SseEventBuffer();
    accountBuffers.set(accountId, buffer);
  }
  return buffer;
}

notificationsRoutes.get("/stream", (c) => {
  const auth = c.get("auth");
  const accountId = auth.accountId;
  const lastEventId = c.req.header("Last-Event-ID");
  const buffer = getOrCreateBuffer(accountId);
  const pubsub = getNotificationPubSub();
  const channel = `${SSE_CHANNEL_PREFIX}${accountId}`;

  return streamSSE(c, async (stream) => {
    // Replay missed events if reconnecting with Last-Event-ID
    if (lastEventId) {
      const missed = buffer.since(lastEventId);
      if (missed === null) {
        // Gap detected — client must full sync
        await stream.writeSSE({
          event: "full-sync",
          data: JSON.stringify({ reason: "replay-window-exceeded" }),
          id: String(buffer.currentId),
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
    const heartbeatTimer = setInterval(() => {
      void stream.write(": heartbeat\n\n").catch(() => {
        // Stream closed — timer will be cleared in cleanup
      });
    }, SSE_HEARTBEAT_INTERVAL_MS);

    // Subscribe to Valkey channel for real-time events
    const messageHandler = (message: string): void => {
      let parsed: { event?: string; data?: unknown };
      try {
        parsed = JSON.parse(message) as { event?: string; data?: unknown };
      } catch {
        return;
      }

      const eventType = typeof parsed.event === "string" ? parsed.event : "notification";
      const data = JSON.stringify(parsed.data ?? parsed);
      const id = buffer.push(eventType, data);

      void stream.writeSSE({ event: eventType, data, id }).catch(() => {
        // Stream closed — will be cleaned up
      });
    };

    if (pubsub) {
      await pubsub.subscribe(channel, messageHandler);
    }

    // Wait for the stream to close (client disconnect)
    // Hono's streamSSE keeps the stream alive until the callback resolves
    // or the client disconnects via AbortSignal
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        resolve();
      });
    });

    // Cleanup
    clearInterval(heartbeatTimer);
    if (pubsub) {
      await pubsub.unsubscribe(channel, messageHandler);
    }
  });
});
