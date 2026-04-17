import { expect, test } from "@playwright/test";

import "./harness-types.js";

/**
 * Worker-spawn failure path: when `new Worker(...)` throws (e.g. CSP blocks
 * worker creation, or the bundle URL is missing), the harness must fall back
 * to the IndexedDB storage adapter instead of hanging on a worker that will
 * never reply. `init()` resolves; SQL-only surfaces throw a typed "not
 * supported in indexeddb mode" error.
 *
 * Uses an isolated page so overriding `window.Worker` does not leak into other
 * tests sharing the worker scope.
 */
test("init falls back to IndexedDB when worker construction fails", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto("/");
    await page.waitForFunction(() => window.__harness !== undefined);

    const outcome = await page.evaluate(async () => {
      // Replace Worker with a constructor that throws at instantiation.
      // Reflect.set avoids `as any` while still mutating the read-only Window
      // typing for `Worker`.
      class BadWorker {
        readonly spawnedAt: number;
        constructor() {
          this.spawnedAt = Date.now();
          throw new Error("simulated worker spawn failure");
        }
      }
      Reflect.set(window, "Worker", BadWorker);

      const h = window.__harness;
      if (h === undefined) return { initResolved: false as const };

      await h.init();

      // After fallback, SQL APIs should throw rather than silently no-op.
      let sqlThrew = false;
      let sqlMessage = "";
      try {
        await h.exec("SELECT 1");
      } catch (err: unknown) {
        sqlThrew = true;
        sqlMessage = err instanceof Error ? err.message : String(err);
      }
      return { initResolved: true as const, sqlThrew, sqlMessage };
    });

    expect(outcome.initResolved).toBe(true);
    if (!outcome.initResolved) throw new Error("init never resolved");
    expect(outcome.sqlThrew).toBe(true);
    expect(outcome.sqlMessage).toMatch(/not supported in indexeddb mode/);
  } finally {
    await context.close();
  }
});

test("IndexedDB fallback adapter actually serves saveSnapshot/loadSnapshot", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Force OPFS off via injected script BEFORE harness loads. A class with a
    // property sidesteps `no-extraneous-class` (see first test for rationale).
    await page.addInitScript(() => {
      class BadWorker {
        readonly spawnedAt: number;
        constructor() {
          this.spawnedAt = Date.now();
          throw new Error("no worker");
        }
      }
      Reflect.set(window, "Worker", BadWorker);
    });
    await page.goto("/");
    await page.waitForFunction(() => window.__harness !== undefined);

    const sizes = await page.evaluate(() => window.__harnessByteSizes);
    if (sizes === undefined) throw new Error("byte sizes missing");

    const roundTrip = await page.evaluate(async (s: typeof sizes) => {
      const h = window.__harness;
      if (h === undefined) throw new Error("harness missing");
      await h.init();
      const ciphertext = new Uint8Array(64).fill(7);
      const nonce = new Uint8Array(s.aeadNonce).fill(1);
      const signature = new Uint8Array(s.signature).fill(2);
      const authorPublicKey = new Uint8Array(s.signPublicKey).fill(3);
      await h.saveSnapshot("doc-fallback", {
        snapshotVersion: 1,
        ciphertext,
        nonce,
        signature,
        authorPublicKey,
      });
      const loaded = await h.loadSnapshot("doc-fallback");
      if (loaded === null) return { ok: false as const, reason: "loaded-null" };
      return {
        ok: true as const,
        version: loaded.snapshotVersion,
        ctLen: loaded.ciphertext.byteLength,
        ctFirst: loaded.ciphertext[0],
      };
    }, sizes);

    expect(roundTrip.ok).toBe(true);
    if (!roundTrip.ok) throw new Error(`round-trip failed: ${roundTrip.reason}`);
    expect(roundTrip.version).toBe(1);
    expect(roundTrip.ctLen).toBe(64);
    expect(roundTrip.ctFirst).toBe(7);
  } finally {
    await context.close();
  }
});
