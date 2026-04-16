import { expect, test } from "@playwright/test";

import "./harness-types.js";

/**
 * Round-trip a small table through the OPFS-backed wa-sqlite driver to confirm
 * exec + run + all all flow through the worker proxy correctly. This is the
 * smoke test that proves the harness is wired end-to-end.
 */
test("inserts and reads back rows via prepared statements", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__harness !== undefined);

  await page.evaluate(async () => {
    const h = window.__harness;
    if (h === undefined) throw new Error("harness missing");
    await h.init();
    await h.reset();
    await h.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)");
    await h.run("INSERT INTO t (id, name) VALUES (?, ?)", [1, "alice"]);
    await h.run("INSERT INTO t (id, name) VALUES (?, ?)", [2, "bob"]);
  });

  const rows = await page.evaluate(async () => {
    const h = window.__harness;
    if (h === undefined) throw new Error("harness missing");
    return h.all("SELECT id, name FROM t WHERE id > ? ORDER BY id", [0]);
  });

  expect(rows).toEqual([
    { id: 1, name: "alice" },
    { id: 2, name: "bob" },
  ]);
});
