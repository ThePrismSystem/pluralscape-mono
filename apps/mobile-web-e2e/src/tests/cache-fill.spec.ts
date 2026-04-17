import { expect, test } from "@playwright/test";

import "./harness-types.js";

const CACHE_SIZE = 128;
const KNOWN_KEY = 1;
const KNOWN_VALUE = 100;

/**
 * Real-worker survival across a prepared-statement cache-fill + eviction sweep.
 *
 * True-LRU semantics (which specific cached pointer gets finalized on
 * eviction) are asserted by the driver's unit tests, which can inspect the
 * cache's internal state directly. This E2E can only observe via SQL results,
 * which cannot distinguish a cache hit from a fresh re-prepare.
 *
 * What the E2E adds: proof that the real OPFS-backed worker survives
 * CACHE_SIZE+1 distinct preparations (which forces at least one eviction
 * sweep) without crashing, losing the underlying DB handle, or corrupting
 * committed data. To make that check non-trivial we write a known row
 * BEFORE filling the cache and read it back AFTER the eviction sweep — if
 * the worker had dropped the DB or mis-managed statement lifetimes, the
 * round-trip would fail or return the wrong value.
 */
test("prepared statements remain correct after the worker cache fills + evicts", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__harness !== undefined);

  const result = await page.evaluate(
    async (args: { size: number; key: number; value: number }) => {
      const h = window.__harness;
      if (h === undefined) throw new Error("harness missing");
      await h.init();
      await h.reset();
      await h.exec("CREATE TABLE lru (k INTEGER PRIMARY KEY, v INTEGER)");
      await h.exec(`INSERT INTO lru (k, v) VALUES (${String(args.key)}, ${String(args.value)})`);

      // Fill the cache with CACHE_SIZE distinct SQL texts.
      for (let i = 0; i < args.size; i++) {
        await h.run(`SELECT ${String(i)} AS x WHERE 1=0`, []);
      }

      // Touch an early statement (would bump it to MRU under true LRU).
      const touched = (await h.all("SELECT 0 AS x WHERE 1=0", [])) as { x: number }[];

      // Add one more distinct SQL — forces an eviction sweep.
      await h.run("SELECT 999 AS x WHERE 1=0", []);

      // Integrity check: the row written before the cache-fill must still
      // read back with the right value. This is the non-trivial assertion
      // proving the worker didn't drop the DB or corrupt statement state.
      const row = (await h.all("SELECT v FROM lru WHERE k = ?", [args.key])) as { v: number }[];

      return { touchedLen: touched.length, rowLen: row.length, rowValue: row[0]?.v ?? null };
    },
    { size: CACHE_SIZE, key: KNOWN_KEY, value: KNOWN_VALUE },
  );

  expect(result.touchedLen).toBe(0);
  expect(result.rowLen).toBe(1);
  expect(result.rowValue).toBe(KNOWN_VALUE);
});
