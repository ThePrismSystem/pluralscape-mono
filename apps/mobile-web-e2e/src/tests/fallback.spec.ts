import { expect, test } from "@playwright/test";

import "./harness-types.js";

/**
 * Worker-spawn failure path: when `new Worker(...)` throws (e.g. CSP blocks
 * worker creation, or the bundle URL is missing), the OPFS driver must surface
 * an error rather than hanging on a worker that will never reply.
 *
 * Uses an isolated page so overriding `window.Worker` does not leak into other
 * tests sharing the worker scope.
 */
test("init rejects when worker construction fails", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto("/");
    await page.waitForFunction(() => window.__harness !== undefined);

    const failure = await page.evaluate(async () => {
      // Replace Worker with a constructor that throws at instantiation.
      // Reflect.set avoids `as any` while still mutating the read-only Window
      // typing for `Worker`. A class with a method plus a constructor sidesteps
      // both `no-extraneous-class` and `no-unnecessary-condition`.
      class BadWorker {
        readonly spawnedAt: number;
        constructor() {
          this.spawnedAt = Date.now();
          throw new Error("simulated worker spawn failure");
        }
      }
      Reflect.set(window, "Worker", BadWorker);

      const h = window.__harness;
      if (h === undefined) return { caught: false as const };

      try {
        await h.init();
        return { caught: false as const };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { caught: true as const, message };
      }
    });

    expect(failure.caught).toBe(true);
    if (!failure.caught) throw new Error("init did not reject");
    expect(failure.message).toMatch(
      /simulated worker spawn failure|OPFS worker failed to initialize/,
    );
  } finally {
    await context.close();
  }
});
