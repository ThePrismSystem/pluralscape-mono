/**
 * Bun-specific WebSocket adapter.
 *
 * Isolates the `hono/bun` import so that code depending on it can be
 * tested in non-Bun environments (e.g. Vitest on Node.js) by mocking
 * this module.
 */
import { upgradeWebSocket, websocket } from "hono/bun";

export { upgradeWebSocket, websocket };
