import { afterEach, describe, expect, it, vi } from "vitest";

import { SERVER_STOP_TIMEOUT_SECONDS } from "../../server.constants.js";

import type { Closeable } from "@pluralscape/db";

// Mock the Bun-specific WebSocket adapter (not available in Node.js/Vitest)
vi.mock("../../ws/bun-adapter.js", () => ({
  upgradeWebSocket: vi.fn(() => vi.fn()),
  websocket: { open: vi.fn(), close: vi.fn(), message: vi.fn() },
}));

const { mockGetRawClient, mockLogInfo, mockLogWarn, mockLogError } = vi.hoisted(() => ({
  mockGetRawClient: vi.fn<() => Closeable | null>(),
  mockLogInfo: vi.fn(),
  mockLogWarn: vi.fn(),
  mockLogError: vi.fn(),
}));

vi.mock("../../lib/db.js", () => ({
  getRawClient: mockGetRawClient,
}));

vi.mock("../../lib/logger.js", () => ({
  logger: {
    info: mockLogInfo,
    warn: mockLogWarn,
    error: mockLogError,
    debug: vi.fn(),
  },
}));

// Import after mocks are set up
const { shutdown } = await import("../../index.js");

afterEach(() => {
  vi.restoreAllMocks();
  mockGetRawClient.mockReset();
  mockLogInfo.mockReset();
  mockLogWarn.mockReset();
  mockLogError.mockReset();
});

describe("shutdown", () => {
  it("calls server.stop() then raw.end() in order", async () => {
    const callOrder: string[] = [];
    const mockStop = vi.fn().mockImplementation(() => {
      callOrder.push("stop");
      return Promise.resolve();
    });
    const mockEnd = vi.fn().mockImplementation(() => {
      callOrder.push("end");
      return Promise.resolve();
    });
    const mockServer = { stop: mockStop };
    const mockRawClient: Closeable = { end: mockEnd };
    mockGetRawClient.mockReturnValue(mockRawClient);

    await shutdown(mockServer);

    expect(mockStop).toHaveBeenCalledOnce();
    expect(mockEnd).toHaveBeenCalledWith({ timeout: expect.any(Number) });
    expect(callOrder).toEqual(["stop", "end"]);
  });

  it("handles null server (skips stop)", async () => {
    const mockEnd = vi.fn().mockResolvedValue(undefined);
    const mockRawClient: Closeable = { end: mockEnd };
    mockGetRawClient.mockReturnValue(mockRawClient);

    await shutdown(null);

    expect(mockEnd).toHaveBeenCalledOnce();
    expect(mockLogInfo).toHaveBeenCalledWith("Shutting down");
  });

  it("handles null rawClient (skips drain)", async () => {
    const mockStop = vi.fn().mockResolvedValue(undefined);
    const mockServer = { stop: mockStop };
    mockGetRawClient.mockReturnValue(null);

    await shutdown(mockServer);

    expect(mockStop).toHaveBeenCalledOnce();
  });

  it("logs warning and continues draining when server.stop() rejects", async () => {
    const mockEnd = vi.fn().mockResolvedValue(undefined);
    const mockServer = {
      stop: vi.fn().mockRejectedValue(new Error("stop failed")),
    };
    const mockRawClient: Closeable = { end: mockEnd };
    mockGetRawClient.mockReturnValue(mockRawClient);

    await shutdown(mockServer);

    expect(mockLogWarn).toHaveBeenCalledOnce();
    expect(mockEnd).toHaveBeenCalledOnce();
  });

  it("continues to drain pool when server.stop() times out", async () => {
    vi.useFakeTimers();
    const mockStop = vi.fn().mockReturnValue(new Promise<void>(() => {})); // never resolves
    const mockEnd = vi.fn().mockResolvedValue(undefined);
    const mockServer = { stop: mockStop };
    const mockRawClient: Closeable = { end: mockEnd };
    mockGetRawClient.mockReturnValue(mockRawClient);

    const promise = shutdown(mockServer);
    await vi.advanceTimersByTimeAsync(SERVER_STOP_TIMEOUT_SECONDS * 1_000);
    await promise;

    expect(mockLogWarn).toHaveBeenCalledOnce();
    expect(mockEnd).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("propagates errors from raw.end()", async () => {
    const mockRawClient: Closeable = {
      end: vi.fn().mockRejectedValue(new Error("drain failed")),
    };
    mockGetRawClient.mockReturnValue(mockRawClient);

    await expect(shutdown(null)).rejects.toThrow("drain failed");
  });
});
