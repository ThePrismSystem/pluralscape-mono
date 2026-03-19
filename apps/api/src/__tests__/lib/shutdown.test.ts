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

  it("handles both null server and null rawClient", async () => {
    mockGetRawClient.mockReturnValue(null);

    await shutdown(null);

    expect(mockLogInfo).toHaveBeenCalledWith("Shutting down");
  });

  it("still drains pool when server.stop() throws", async () => {
    const mockEnd = vi.fn().mockResolvedValue(undefined);
    const mockRawClient: Closeable = { end: mockEnd };
    mockGetRawClient.mockReturnValue(mockRawClient);
    const mockServer = {
      stop: vi.fn().mockRejectedValue(new Error("stop failed")),
    };

    await expect(shutdown(mockServer)).rejects.toThrow("stop failed");
    expect(mockEnd).toHaveBeenCalledWith({ timeout: expect.any(Number) });
  });

  it("propagates errors from raw.end()", async () => {
    const mockRawClient: Closeable = {
      end: vi.fn().mockRejectedValue(new Error("drain failed")),
    };
    mockGetRawClient.mockReturnValue(mockRawClient);

    await expect(shutdown(null)).rejects.toThrow("drain failed");
  });
});
