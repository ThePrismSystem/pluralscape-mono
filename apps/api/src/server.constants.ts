/**
 * Server configuration constants.
 * Domain: API server startup and networking.
 */

/** Default port the API server listens on when API_PORT is not set (10045). */
export const DEFAULT_PORT = 10_045;

/** Seconds to wait for the connection pool to drain during shutdown. */
export const SHUTDOWN_TIMEOUT_SECONDS = 5;

/** Seconds to wait for server.stop() before force-proceeding to pool drain. */
export const SERVER_STOP_TIMEOUT_SECONDS = 5;
