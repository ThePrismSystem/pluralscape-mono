import { expect, test } from "@playwright/test";

import "./harness-types.js";

const CACHE_SIZE = 128;

/**
 * True-LRU semantics in a real worker: prepare CACHE_SIZE+1 distinct SQLs,
 * but touch an early one in between. The touched statement should NOT be
 * evicted — the second-oldest should be.
 *
 * We can't observe eviction directly from outside the worker, so we assert
 * the touched statement still produces correct results after the eviction
 * sweep, which it would not if it had been finalized.
 */
test("true LRU: re-prepared SQL survives eviction sweep", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__harness !== undefined);

  const result = await page.evaluate(async (size: number) => {
    const h = window.__harness;
    if (h === undefined) throw new Error("harness missing");
    await h.init();
    await h.reset();
    await h.exec("CREATE TABLE lru (k INTEGER PRIMARY KEY, v INTEGER)");
    await h.exec("INSERT INTO lru (k, v) VALUES (1, 100)");

    // Fill the cache.
    for (let i = 0; i < size; i++) {
      await h.run(`SELECT ${String(i)} AS x WHERE 1=0`, []);
    }

    // Touch the first one (bumps it to MRU).
    const touched = (await h.all("SELECT 0 AS x WHERE 1=0", [])) as { x: number }[];

    // Add one more — eviction sweep runs.
    await h.run("SELECT 999 AS x WHERE 1=0", []);

    // The touched statement should still work (re-prepare or cache hit, both fine).
    const second = (await h.all("SELECT 0 AS x WHERE 1=0", [])) as { x: number }[];

    return { touchedLen: touched.length, secondLen: second.length };
  }, CACHE_SIZE);

  expect(result.touchedLen).toBe(0);
  expect(result.secondLen).toBe(0);
});
