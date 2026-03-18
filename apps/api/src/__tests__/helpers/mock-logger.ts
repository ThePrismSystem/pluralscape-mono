import { vi } from "vitest";

import { APP_LOGGER_BRAND } from "../../lib/logger.js";

import type { AppLogger } from "../../lib/logger.js";
import type { Mock } from "vitest";

type LogFn = (message: string, data?: Record<string, unknown>) => void;

export interface MockLoggerMethods {
  info: Mock<LogFn>;
  warn: Mock<LogFn>;
  error: Mock<LogFn>;
  debug: Mock<LogFn>;
}

/** Creates a branded AppLogger mock with accessible method spies. */
export function createMockLogger(): { logger: AppLogger; methods: MockLoggerMethods } {
  const info = vi.fn<LogFn>();
  const warn = vi.fn<LogFn>();
  const error = vi.fn<LogFn>();
  const debug = vi.fn<LogFn>();
  const methods: MockLoggerMethods = { info, warn, error, debug };
  const logger: AppLogger = {
    [APP_LOGGER_BRAND]: true as const,
    info,
    warn,
    error,
    debug,
  };
  return { logger, methods };
}
