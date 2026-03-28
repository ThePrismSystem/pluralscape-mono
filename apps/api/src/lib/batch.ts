/**
 * Generic concurrency utility for batched async execution.
 */

/**
 * Maximum number of concurrent manifest COUNT queries per batch.
 *
 * Limits connection pool contention when building manifests across all
 * 21 entity types. Queries run in sequential batches of this size.
 */
export const MANIFEST_BATCH_SIZE = 5;

/**
 * Execute async tasks in sequential batches to limit concurrency.
 *
 * Runs up to MANIFEST_BATCH_SIZE tasks in parallel per batch, waiting
 * for each batch to complete before starting the next. This prevents
 * 21 simultaneous COUNT queries from saturating the connection pool.
 */
export async function batchedManifestQueries<T>(
  tasks: readonly (() => Promise<T>)[],
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += MANIFEST_BATCH_SIZE) {
    const batch = tasks.slice(i, i + MANIFEST_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((task) => task()));
    results.push(...batchResults);
  }
  return results;
}
