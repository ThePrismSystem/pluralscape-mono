import { vi } from "vitest";

import type { ConnectionManager } from "../../ws/connection-manager.js";
import type { Mock } from "vitest";

export { createMockLogger } from "./mock-logger.js";
export type { MockLoggerMethods } from "./mock-logger.js";

/** Minimal mock WebSocket with send and close stubs. */
export interface MockWs {
  send: Mock;
  close: Mock;
}

export function mockWs(): MockWs {
  return { close: vi.fn(), send: vi.fn() };
}

type RegisterWs = Parameters<ConnectionManager["register"]>[1];

/**
 * Widen a MockWs through `unknown` so the cast to the manager's WSContext
 * parameter is a single `as` step. The mock only exposes the methods the
 * manager exercises (notably `close` and `send`).
 */
export function asRegisterWs(ws: MockWs): RegisterWs {
  const opaque: unknown = ws;
  return opaque as RegisterWs;
}
