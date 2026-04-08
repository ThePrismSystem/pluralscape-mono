import type { ImportSource, SourceDocument } from "./source.types.js";
import type { SpCollectionName } from "./sp-collections.js";

/**
 * In-memory `ImportSource` backed by a plain JS object. Used in tests and the
 * fixture-driven integration tests. Not exported from the package root because
 * production code never imports it directly.
 *
 * Documents are typed as `Record<string, unknown>` so that test fixtures can
 * include intentionally malformed shapes (e.g. missing `_id`) without resorting
 * to unsafe casts. The runtime check below enforces that every yielded document
 * has a string `_id`.
 */
export type FakeSourceData = Partial<Record<SpCollectionName, readonly Record<string, unknown>[]>>;

export function createFakeImportSource(data: FakeSourceData): ImportSource {
  return {
    mode: "fake",
    async *iterate(collection: SpCollectionName): AsyncGenerator<SourceDocument> {
      // Yield to the microtask queue so this conforms to async-iterator semantics
      // even though the in-memory backing store is synchronous.
      await Promise.resolve();
      const docs = data[collection] ?? [];
      for (const document of docs) {
        const rawId = document._id;
        if (typeof rawId !== "string" || rawId.length === 0) {
          throw new Error(
            `FakeImportSource: ${collection} document is missing _id (got ${JSON.stringify(document)})`,
          );
        }
        yield {
          collection,
          sourceId: rawId,
          document,
        };
      }
    },
    async close() {
      // no-op
    },
  };
}
