import { toUnixMillis } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import { StalledJobSweeper } from "../observability/stalled-sweeper.js";

import { dequeueOrFail, makeJobParams } from "./helpers.js";
import { InMemoryJobQueue } from "./mock-queue.js";

import type { Logger } from "@pluralscape/types";

const mockLogger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe("StalledJobSweeper", () => {
  it("starts and stops cleanly", () => {
    const queue = new InMemoryJobQueue(mockLogger);
    const sweeper = new StalledJobSweeper(queue, { intervalMs: 60_000, logger: mockLogger });
    expect(sweeper.isRunning()).toBe(false);
    sweeper.start();
    expect(sweeper.isRunning()).toBe(true);
    sweeper.stop();
    expect(sweeper.isRunning()).toBe(false);
  });

  it("start() is idempotent — calling twice does not create two timers", () => {
    const queue = new InMemoryJobQueue(mockLogger);
    const sweeper = new StalledJobSweeper(queue, { intervalMs: 60_000, logger: mockLogger });
    sweeper.start();
    sweeper.start(); // should be a no-op
    expect(sweeper.isRunning()).toBe(true);
    sweeper.stop();
    expect(sweeper.isRunning()).toBe(false);
  });

  it("sweep() fails stalled jobs and calls onSweep with count", async () => {
    let currentTime = toUnixMillis(1000);
    const queue = new InMemoryJobQueue(mockLogger, () => currentTime);
    const onSweep = vi.fn();
    const sweeper = new StalledJobSweeper(queue, { onSweep, logger: mockLogger });

    await queue.enqueue(makeJobParams({ timeoutMs: 3000 }));
    await dequeueOrFail(queue);

    // Advance time past the timeout
    currentTime = toUnixMillis(5000);

    await sweeper.sweep();

    expect(onSweep).toHaveBeenCalledWith(1);
    // The stalled job should now be failed/pending (retried) or dead-lettered
    const stalled = await queue.findStalledJobs();
    expect(stalled).toHaveLength(0);
  });

  it("sweep() calls onSweep with 0 when no stalled jobs", async () => {
    const queue = new InMemoryJobQueue(mockLogger);
    const onSweep = vi.fn();
    const sweeper = new StalledJobSweeper(queue, { onSweep, logger: mockLogger });

    await sweeper.sweep();

    expect(onSweep).toHaveBeenCalledWith(0);
  });

  it("sweep() logs stalled jobs when a logger is provided", async () => {
    let currentTime = toUnixMillis(1000);
    const queue = new InMemoryJobQueue(mockLogger, () => currentTime);
    const warn = vi.fn();
    const sweeper = new StalledJobSweeper(queue, {
      logger: { info: vi.fn(), warn, error: vi.fn() },
    });

    await queue.enqueue(makeJobParams({ timeoutMs: 3000 }));
    await dequeueOrFail(queue);
    currentTime = toUnixMillis(5000);

    await sweeper.sweep();

    expect(warn).toHaveBeenCalledWith(
      "stalled-sweeper.found",
      expect.objectContaining({ count: 1 }),
    );
  });

  it("skips sweep when a previous sweep is still running", async () => {
    const queue = new InMemoryJobQueue(mockLogger);
    const sweeper = new StalledJobSweeper(queue, { logger: mockLogger });

    let resolveFirst!: () => void;
    const blockingPromise = new Promise<readonly import("@pluralscape/types").JobDefinition[]>(
      (resolve) => {
        resolveFirst = () => {
          resolve([]);
        };
      },
    );

    const spy = vi.spyOn(queue, "findStalledJobs").mockReturnValueOnce(blockingPromise);

    // Start first sweep (will block)
    const firstSweep = sweeper.sweep();

    // Second sweep should be skipped (guard active)
    await sweeper.sweep();

    // Unblock first sweep
    resolveFirst();
    await firstSweep;

    // findStalledJobs called only once (the second sweep was skipped)
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("resets sweeping flag even when sweep throws", async () => {
    const queue = new InMemoryJobQueue(mockLogger);
    const sweeper = new StalledJobSweeper(queue, { logger: mockLogger });

    const spy = vi.spyOn(queue, "findStalledJobs").mockRejectedValueOnce(new Error("db down"));
    await sweeper.sweep();

    // Second sweep should execute (flag was reset in finally)
    spy.mockResolvedValueOnce([]);
    await sweeper.sweep();

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("sweep() does not throw when findStalledJobs() rejects (logs error instead)", async () => {
    const queue = new InMemoryJobQueue(mockLogger);
    const error = vi.fn();
    const sweeper = new StalledJobSweeper(queue, {
      logger: { info: vi.fn(), warn: vi.fn(), error },
    });

    vi.spyOn(queue, "findStalledJobs").mockRejectedValue(new Error("db connection lost"));

    await expect(sweeper.sweep()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "stalled-sweeper.sweep-error",
      expect.objectContaining({ error: "db connection lost" }),
    );
  });

  it("sweep() does not throw when fail() rejects (logs error instead)", async () => {
    const queue = new InMemoryJobQueue(mockLogger);
    const error = vi.fn();
    const sweeper = new StalledJobSweeper(queue, {
      logger: { info: vi.fn(), warn: vi.fn(), error },
    });

    // Force findStalledJobs to return a fake stalled job
    const fakeJob = { id: "fake-id" as import("@pluralscape/types").JobId };
    vi.spyOn(queue, "findStalledJobs").mockResolvedValue([
      fakeJob as import("@pluralscape/types").JobDefinition,
    ]);
    vi.spyOn(queue, "fail").mockRejectedValue(new Error("job gone"));

    await expect(sweeper.sweep()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "stalled-sweeper.fail-error",
      expect.objectContaining({ jobId: "fake-id", error: "job gone" }),
    );
  });
});
