import type { PGlite, Transaction } from "@electric-sql/pglite";

class RollbackError extends Error {
  constructor() {
    super("Transaction rolled back");
  }
}

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
      throw new RollbackError();
    });
  } catch (error: unknown) {
    if (!(error instanceof RollbackError)) {
      throw error;
    }
  }
}
