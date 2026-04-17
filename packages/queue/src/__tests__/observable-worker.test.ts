import { brandId } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import { ObservableJobWorker } from "../observability/observable-worker.js";

import type { JobHandler, JobWorker } from "../job-worker.js";
import type { JobDefinition, JobId, JobType, Logger } from "@pluralscape/types";

const fakeJob = {
  id: brandId<JobId>("job_test"),
  type: "sync-push" as JobType,
} as JobDefinition;

function makeLogger(): {
  logger: Logger;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  const info = vi.fn();
  const warn = vi.fn();
  const error = vi.fn();
  return { logger: { info, warn, error }, info, warn, error };
}

function makeInnerWorker(): {
  inner: JobWorker;
  registerHandler: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  isRunning: ReturnType<typeof vi.fn>;
  registeredTypes: ReturnType<typeof vi.fn>;
} {
  const registerHandler = vi.fn();
  const start = vi.fn().mockResolvedValue(undefined);
  const stop = vi.fn().mockResolvedValue(undefined);
  const isRunning = vi.fn().mockReturnValue(false);
  const registeredTypes = vi.fn().mockReturnValue(["sync-push"]);
  const inner: JobWorker = { registerHandler, start, stop, isRunning, registeredTypes };
  return { inner, registerHandler, start, stop, isRunning, registeredTypes };
}

describe("ObservableJobWorker", () => {
  it("registerHandler wraps handler and delegates to inner", () => {
    const { inner, registerHandler } = makeInnerWorker();
    const { logger } = makeLogger();
    const worker = new ObservableJobWorker(inner, logger);
    const handler: JobHandler = vi.fn().mockResolvedValue(undefined);

    worker.registerHandler("sync-push", handler);

    expect(registerHandler).toHaveBeenCalledWith("sync-push", expect.any(Function));
  });

  it("wrapped handler logs processing and success on successful execution", async () => {
    const { inner, registerHandler } = makeInnerWorker();
    const { logger, info } = makeLogger();
    const worker = new ObservableJobWorker(inner, logger);
    const handler: JobHandler = vi.fn().mockResolvedValue(undefined);

    worker.registerHandler("sync-push", handler);

    // Extract the wrapped handler that was passed to inner.registerHandler
    const wrappedHandler = registerHandler.mock.calls[0]?.[1] as JobHandler;
    const ctx = {
      heartbeat: { heartbeat: vi.fn().mockResolvedValue(undefined) },
      signal: new AbortController().signal,
    };

    await wrappedHandler(fakeJob, ctx);

    expect(info).toHaveBeenCalledWith(
      "job.processing",
      expect.objectContaining({ jobId: "job_test", type: "sync-push" }),
    );
    expect(info).toHaveBeenCalledWith(
      "job.handler-succeeded",
      expect.objectContaining({ jobId: "job_test", type: "sync-push" }),
    );
  });

  it("wrapped handler logs processing and failure, then re-throws", async () => {
    const { inner, registerHandler } = makeInnerWorker();
    const { logger, info, error } = makeLogger();
    const worker = new ObservableJobWorker(inner, logger);
    const handler: JobHandler = vi.fn().mockRejectedValue(new Error("boom"));

    worker.registerHandler("sync-push", handler);

    const wrappedHandler = registerHandler.mock.calls[0]?.[1] as JobHandler;
    const ctx = {
      heartbeat: { heartbeat: vi.fn().mockResolvedValue(undefined) },
      signal: new AbortController().signal,
    };

    await expect(wrappedHandler(fakeJob, ctx)).rejects.toThrow("boom");

    expect(info).toHaveBeenCalledWith(
      "job.processing",
      expect.objectContaining({ jobId: "job_test" }),
    );
    expect(error).toHaveBeenCalledWith(
      "job.handler-failed",
      expect.objectContaining({ jobId: "job_test", error: "boom" }),
    );
  });

  it("start() logs and delegates", async () => {
    const { inner, start } = makeInnerWorker();
    const { logger, info } = makeLogger();
    const worker = new ObservableJobWorker(inner, logger);

    await worker.start();

    expect(info).toHaveBeenCalledWith("worker.starting");
    expect(start).toHaveBeenCalledOnce();
  });

  it("stop() logs and delegates", async () => {
    const { inner, stop } = makeInnerWorker();
    const { logger, info } = makeLogger();
    const worker = new ObservableJobWorker(inner, logger);

    await worker.stop();

    expect(info).toHaveBeenCalledWith("worker.stopping");
    expect(stop).toHaveBeenCalledOnce();
  });

  it("isRunning() delegates", () => {
    const { inner, isRunning } = makeInnerWorker();
    const { logger } = makeLogger();
    const worker = new ObservableJobWorker(inner, logger);
    isRunning.mockReturnValue(true);

    expect(worker.isRunning()).toBe(true);
    expect(isRunning).toHaveBeenCalledOnce();
  });

  it("registeredTypes() delegates", () => {
    const { inner, registeredTypes } = makeInnerWorker();
    const { logger } = makeLogger();
    const worker = new ObservableJobWorker(inner, logger);
    registeredTypes.mockReturnValue(["sync-push", "blob-upload"]);

    expect(worker.registeredTypes()).toEqual(["sync-push", "blob-upload"]);
    expect(registeredTypes).toHaveBeenCalledOnce();
  });
});
