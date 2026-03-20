/**
 * Server-Sent Events (SSE) configuration constants.
 * Domain: SSE notification stream endpoint.
 */

/** Heartbeat interval in milliseconds (30 seconds). */
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000;

/** Maximum number of events retained in the replay ring buffer. */
export const SSE_REPLAY_BUFFER_SIZE = 100;

/** Maximum age of events eligible for replay in milliseconds (5 minutes). */
export const SSE_REPLAY_MAX_AGE_MS = 300_000;

/** Prefix for SSE notification Valkey channels. */
export const SSE_CHANNEL_PREFIX = "ps:notify:";
