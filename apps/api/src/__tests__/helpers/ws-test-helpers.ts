import { vi } from "vitest";

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
