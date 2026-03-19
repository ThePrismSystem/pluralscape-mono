import { afterEach, describe, expect, it, vi } from "vitest";

import type { Closeable } from "@pluralscape/db";

const { mockGetRawClient, mockLogInfo, mockLogError } = vi.hoisted(() => ({
  mockGetRawClient: vi.fn<() => Closeable | null>(),
  mockLogInfo: vi.fn(),
  mockLogError: vi.fn(),
}));

vi.mock("../../lib/db.js", () => ({
  getRawClient: mockGetRawClient,
}));

vi.mock("../../lib/logger.js", () => ({
  logger: {
    info: mockLogInfo,
    warn: vi.fn(),
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

  it("propagates errors from server.stop()", async () => {
    const mockServer = {
      stop: vi.fn().mockRejectedValue(new Error("stop failed")),
    };
    mockGetRawClient.mockReturnValue(null);

    await expect(shutdown(mockServer)).rejects.toThrow("stop failed");
  });

  it("propagates errors from raw.end()", async () => {
    const mockRawClient: Closeable = {
      end: vi.fn().mockRejectedValue(new Error("drain failed")),
    };
    mockGetRawClient.mockReturnValue(mockRawClient);

    await expect(shutdown(null)).rejects.toThrow("drain failed");
  });
});
