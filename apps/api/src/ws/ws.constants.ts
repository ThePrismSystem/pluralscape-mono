/**
 * WebSocket server constants.
 * Domain: real-time sync transport (ADR 007).
 */

/** Maximum WebSocket message size in bytes (5 MB = 5 * 1_024 * 1_024, per protocol spec). */
export const WS_MAX_MESSAGE_BYTES = 5 * 1_024 * 1_024;

/** Milliseconds to wait for AuthenticateRequest before closing the connection. */
export const WS_AUTH_TIMEOUT_MS = 10_000;

/** Seconds of inactivity before Bun closes the WebSocket connection. */
export const WS_IDLE_TIMEOUT_SECONDS = 60;

/** WebSocket subprotocol identifier for the sync protocol. */
export const WS_SUBPROTOCOL = "pluralscape-sync-v1";

/** Maximum mutation messages (SubmitChange, SubmitSnapshot) per rate window. */
export const WS_MUTATION_RATE_LIMIT = 100;

/** Rate window duration for mutation messages in milliseconds. */
export const WS_MUTATION_RATE_WINDOW_MS = 10_000;

/** Maximum read messages (Fetch*, Manifest*) per rate window. */
export const WS_READ_RATE_LIMIT = 200;

/** Rate window duration for read messages in milliseconds. */
export const WS_READ_RATE_WINDOW_MS = 10_000;

/** Global cap on unauthenticated WebSocket connections (Slowloris prevention). */
export const WS_MAX_UNAUTHED_CONNECTIONS = 500;

/** Maximum concurrent WebSocket connections per account. */
export const WS_MAX_CONNECTIONS_PER_ACCOUNT = 10;

/** Interval for periodic session revocation sweep when Valkey is unavailable. */
export const WS_REVOCATION_CHECK_INTERVAL_MS = 60_000;

/** Valkey channel prefix for document change notifications. */
export const VALKEY_CHANNEL_PREFIX_SYNC = "ps:sync:";

/** Valkey channel prefix for manifest change notifications. */
export const VALKEY_CHANNEL_PREFIX_MANIFEST = "ps:manifest:";

/** Valkey channel prefix for session revocation fan-out. */
export const VALKEY_CHANNEL_PREFIX_REVOKE = "ps:revoke:";

/** WebSocket close code 1001: server is going away (shutdown). */
export const WS_CLOSE_GOING_AWAY = 1001;

/** WebSocket close code 1008: policy violation (RFC 6455). */
export const WS_CLOSE_POLICY_VIOLATION = 1008;

/** WebSocket close code 1011: unexpected condition (RFC 6455). */
export const WS_CLOSE_UNEXPECTED = 1011;

/** Timeout in milliseconds for Valkey connection attempts. */
export const WS_VALKEY_CONNECT_TIMEOUT_MS = 5_000;

/** Maximum number of documents tracked in the in-memory relay before LRU eviction. */
export const WS_RELAY_MAX_DOCUMENTS = 1_000;

/** Number of consecutive rate limit strikes before closing the connection. */
export const WS_RATE_LIMIT_STRIKE_MAX = 10;

/** Maximum number of documents in a single SubscribeRequest. */
export const WS_MAX_SUBSCRIBE_DOCUMENTS = 100;

/** Maximum document subscriptions per connection (prevents unbounded memory growth). */
export const WS_MAX_SUBSCRIPTIONS_PER_CONNECTION = 500;

/** Safety timeout (ms) to release unauth slot if onOpen never fires after upgrade. */
export const WS_UPGRADE_SAFETY_TIMEOUT_MS = 5_000;

/** Maximum concurrent document catchup fetches during subscribe (prevents resource exhaustion). */
export const WS_SUBSCRIBE_CONCURRENCY = 10;

/** Maximum envelopes returned per paginated getEnvelopesSince call (P-H1 audit finding). */
export const WS_ENVELOPE_PAGE_SIZE = 500;

/** Default timeout (ms) for graceful WebSocket shutdown. */
export const WS_GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10_000;

/** Polling interval (ms) for checking connection drain during graceful shutdown. */
export const WS_SHUTDOWN_DRAIN_POLL_MS = 50;
