import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted ensures these are initialized before vi.mock factory runs
const {
  mockChild,
  mockInfo,
  mockWarn,
  mockError,
  mockDebug,
  childInfo,
  childWarn,
  childError,
  childDebug,
} = vi.hoisted(() => ({
  mockChild: vi.fn(),
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
  mockDebug: vi.fn(),
  childInfo: vi.fn(),
  childWarn: vi.fn(),
  childError: vi.fn(),
  childDebug: vi.fn(),
}));

vi.mock("pino", () => ({
  default: vi.fn(() => ({
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
    debug: mockDebug,
    child: mockChild.mockReturnValue({
      info: childInfo,
      warn: childWarn,
      error: childError,
      debug: childDebug,
    }),
  })),
}));

describe("logger", () => {
  beforeEach(() => {
    vi.resetModules();
    mockChild.mockClear();
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
    mockDebug.mockClear();
    childInfo.mockClear();
    childWarn.mockClear();
    childError.mockClear();
    childDebug.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports a logger with info, warn, error, debug methods", async () => {
    const { logger } = await import("../../lib/logger.js");

    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("logger.info delegates to pino with message only", async () => {
    const { logger } = await import("../../lib/logger.js");

    logger.info("test message");

    expect(mockInfo).toHaveBeenCalledWith("test message");
  });

  it("logger.info delegates to pino with message and data", async () => {
    const { logger } = await import("../../lib/logger.js");

    logger.info("test message", { port: 3000 });

    expect(mockInfo).toHaveBeenCalledWith({ port: 3000 }, "test message");
  });

  it("logger.warn delegates to pino with message only", async () => {
    const { logger } = await import("../../lib/logger.js");

    logger.warn("warning message");

    expect(mockWarn).toHaveBeenCalledWith("warning message");
  });

  it("logger.warn delegates to pino with message and data", async () => {
    const { logger } = await import("../../lib/logger.js");

    logger.warn("warning message", { detail: "info" });

    expect(mockWarn).toHaveBeenCalledWith({ detail: "info" }, "warning message");
  });

  it("logger.error delegates to pino with message only", async () => {
    const { logger } = await import("../../lib/logger.js");

    logger.error("error message");

    expect(mockError).toHaveBeenCalledWith("error message");
  });

  it("logger.error delegates to pino with message and data", async () => {
    const { logger } = await import("../../lib/logger.js");

    logger.error("error message", { code: "ERR_TEST" });

    expect(mockError).toHaveBeenCalledWith({ code: "ERR_TEST" }, "error message");
  });

  it("logger.debug delegates to pino with message only", async () => {
    const { logger } = await import("../../lib/logger.js");

    logger.debug("debug message");

    expect(mockDebug).toHaveBeenCalledWith("debug message");
  });

  it("logger.debug delegates to pino with message and data", async () => {
    const { logger } = await import("../../lib/logger.js");

    logger.debug("debug message", { key: "value" });

    expect(mockDebug).toHaveBeenCalledWith({ key: "value" }, "debug message");
  });

  it("createRequestLogger creates a child logger with requestId", async () => {
    const { createRequestLogger } = await import("../../lib/logger.js");

    const requestId = "019012ab-cdef-7890-abcd-ef1234567890";
    const childLogger = createRequestLogger(requestId);

    expect(mockChild).toHaveBeenCalledWith({ requestId });
    expect(typeof childLogger.info).toBe("function");
  });

  it("child logger delegates calls to pino child instance", async () => {
    const { createRequestLogger } = await import("../../lib/logger.js");

    const childLogger = createRequestLogger("req-123");

    childLogger.info("child info");
    expect(childInfo).toHaveBeenCalledWith("child info");

    childLogger.warn("child warn", { detail: "x" });
    expect(childWarn).toHaveBeenCalledWith({ detail: "x" }, "child warn");

    childLogger.error("child error");
    expect(childError).toHaveBeenCalledWith("child error");

    childLogger.debug("child debug");
    expect(childDebug).toHaveBeenCalledWith("child debug");
  });
});

describe("getContextLogger", () => {
  beforeEach(() => {
    vi.resetModules();
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
    mockDebug.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the logger from context when branded AppLogger is present", async () => {
    const { getContextLogger, createRequestLogger } = await import("../../lib/logger.js");
    const brandedLogger = createRequestLogger("req-test");
    const c = { get: () => brandedLogger };

    const result = getContextLogger(c);
    expect(result).toBe(brandedLogger);
  });

  it("falls back to root logger when context has no logger", async () => {
    const { getContextLogger, logger } = await import("../../lib/logger.js");
    const c = { get: () => undefined };

    const result = getContextLogger(c);
    expect(result).toBe(logger);
  });

  it("falls back to root logger when context has non-branded object", async () => {
    const { getContextLogger, logger } = await import("../../lib/logger.js");
    const c = { get: () => ({ error: "not a logger" }) };

    const result = getContextLogger(c);
    expect(result).toBe(logger);
  });

  it("falls back to root logger when context returns null", async () => {
    const { getContextLogger, logger } = await import("../../lib/logger.js");
    const c = { get: () => null };

    const result = getContextLogger(c);
    expect(result).toBe(logger);
  });

  it("branded logger carries the APP_LOGGER_BRAND symbol", async () => {
    const { createRequestLogger, APP_LOGGER_BRAND: brand } = await import("../../lib/logger.js");
    const brandedLogger = createRequestLogger("req-brand");
    expect(brand in brandedLogger).toBe(true);
  });
});
