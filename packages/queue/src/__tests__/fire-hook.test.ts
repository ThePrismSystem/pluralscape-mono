import { describe, expect, it, vi } from "vitest";

import { fireHook } from "../fire-hook.js";

import type { JobEventHooks } from "../event-hooks.js";
import type { JobDefinition, JobId, Logger } from "@pluralscape/types";

const fakeJob = { id: "job_test" as JobId, type: "sync-push" } as JobDefinition;

function makeLogger(): { logger: Logger; errorFn: ReturnType<typeof vi.fn> } {
  const errorFn = vi.fn();
  const logger: Logger = { info: vi.fn(), warn: vi.fn(), error: errorFn };
  return { logger, errorFn };
}

describe("fireHook", () => {
  it("dispatches onComplete when event is 'onComplete'", async () => {
    const onComplete = vi.fn();
    const hooks: JobEventHooks = { onComplete };
    await fireHook(hooks, "onComplete", fakeJob);
    expect(onComplete).toHaveBeenCalledWith(fakeJob);
  });

  it("dispatches onFail with error when event is 'onFail'", async () => {
    const onFail = vi.fn();
    const hooks: JobEventHooks = { onFail };
    const error = new Error("boom");
    await fireHook(hooks, "onFail", fakeJob, error);
    expect(onFail).toHaveBeenCalledWith(fakeJob, error);
  });

  it("does not dispatch onFail when error is undefined (runtime guard)", async () => {
    const onFail = vi.fn();
    const hooks: JobEventHooks = { onFail };
    // @ts-expect-error Overload prevents this at compile time, testing runtime guard
    await fireHook(hooks, "onFail", fakeJob);
    expect(onFail).not.toHaveBeenCalled();
  });

  it("dispatches onDeadLetter when event is 'onDeadLetter'", async () => {
    const onDeadLetter = vi.fn();
    const hooks: JobEventHooks = { onDeadLetter };
    await fireHook(hooks, "onDeadLetter", fakeJob);
    expect(onDeadLetter).toHaveBeenCalledWith(fakeJob);
  });

  it("does nothing when hook is not defined", async () => {
    const hooks: JobEventHooks = {};
    await expect(fireHook(hooks, "onComplete", fakeJob)).resolves.toBeUndefined();
  });

  it("swallows hook errors without throwing", async () => {
    const hooks: JobEventHooks = {
      onComplete: () => {
        throw new Error("hook exploded");
      },
    };
    await expect(fireHook(hooks, "onComplete", fakeJob)).resolves.toBeUndefined();
  });

  it("logs hook errors when logger is provided", async () => {
    const hooks: JobEventHooks = {
      onComplete: () => {
        throw new Error("hook exploded");
      },
    };
    const { logger, errorFn } = makeLogger();
    await fireHook(hooks, "onComplete", fakeJob, undefined, logger);
    expect(errorFn).toHaveBeenCalledWith(
      "hook.error",
      expect.objectContaining({
        event: "onComplete",
        jobId: "job_test",
        error: "hook exploded",
      }),
    );
  });

  it("silently swallows errors when no logger is provided", async () => {
    const hooks: JobEventHooks = {
      onDeadLetter: () => {
        throw new Error("oops");
      },
    };
    await expect(fireHook(hooks, "onDeadLetter", fakeJob)).resolves.toBeUndefined();
  });

  it("requires error argument for onFail event (type-level check)", () => {
    const hooks: JobEventHooks = { onFail: vi.fn() };
    // @ts-expect-error onFail requires an Error argument
    void fireHook(hooks, "onFail", fakeJob);
  });
});
