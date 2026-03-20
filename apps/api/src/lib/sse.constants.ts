/**
 * Server-Sent Events (SSE) configuration constants.
 * Domain: SSE notification stream endpoint.
 */

/** Heartbeat interval in milliseconds (30 seconds). */
export const SSE_HEARTBEAT_INTERVAL_MS = 30_000;

/** Maximum number of events retained in the replay ring buffer. */
export const SSE_REPLAY_BUFFER_SIZE = 100;

/** Maximum age of events eligible for replay in milliseconds (5 minutes = 5 * 60 * 1_000). */
export const SSE_REPLAY_MAX_AGE_MS = 5 * 60 * 1_000;

/** Maximum concurrent SSE connections per account (prevents resource exhaustion). */
export const SSE_MAX_CONNECTIONS_PER_ACCOUNT = 5;

/** Prefix for SSE notification Valkey channels. */
export const SSE_CHANNEL_PREFIX = "ps:notify:";
