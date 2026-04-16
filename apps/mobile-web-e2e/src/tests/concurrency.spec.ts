import { expect, test } from "@playwright/test";

import "./harness-types.js";

const INSERT_COUNT = 200;

/**
 * Fan out 200 concurrent writes through the worker proxy and verify the
 * driver's request/response correlation handles a high in-flight queue
 * without dropping or interleaving responses.
 *
 * We use `exec` rather than `run(?, ?)` here because the controller's `run`
 * helper prepares a fresh statement per call, and the worker's prepared-
 * statement cache (MAX_STMT_HANDLES=128) starts evicting once the in-flight
 * count exceeds it — that's expected backpressure, not a concurrency bug we
 * want this test to exercise. `exec` exercises the proxy fan-out without
 * touching the statement cache.
 */
test("handles many concurrent writes without losing rows", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__harness !== undefined);

  const total = await page.evaluate(async (count: number) => {
    const h = window.__harness;
    if (h === undefined) throw new Error("harness missing");
    await h.init();
    await h.reset();
    await h.exec("CREATE TABLE c (id INTEGER PRIMARY KEY, v INTEGER)");
    const writes: Promise<void>[] = [];
    for (let i = 0; i < count; i++) {
      writes.push(h.exec(`INSERT INTO c (id, v) VALUES (${String(i)}, ${String(i * 2)})`));
    }
    await Promise.all(writes);
    const rows = (await h.all("SELECT COUNT(*) AS n FROM c", [])) as { n: number }[];
    const first = rows[0];
    if (first === undefined) throw new Error("count query returned no rows");
    return first.n;
  }, INSERT_COUNT);

  expect(total).toBe(INSERT_COUNT);
});
