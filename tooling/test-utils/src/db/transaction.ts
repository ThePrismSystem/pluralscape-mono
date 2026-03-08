import type { PGlite, Transaction } from "@electric-sql/pglite";

/**
 * Wraps a test callback in a transaction that is always rolled back,
 * ensuring test isolation within a shared PGlite instance.
 *
 * Usage:
 * ```ts
 * await withTestTransaction(client, async (tx) => {
 *   await tx.query("INSERT INTO ...");
 *   // assertions here
 * });
 * // All changes are rolled back
 * ```
 */
export async function withTestTransaction(
  client: PGlite,
  callback: (tx: Transaction) => Promise<void>,
): Promise<void> {
  try {
    await client.transaction(async (tx) => {
      await callback(tx);
      void tx.rollback();
    });
  } catch {
    // Transaction rollback throws — this is expected behavior
  }
}
