import type { ImportDataSource, SourceDocument } from "./source.types.js";
import type { SpCollectionName } from "./sp-collections.js";

/**
 * In-memory `ImportDataSource` backed by a plain JS object. Used in tests and the
 * fixture-driven integration tests. Not exported from the package root because
 * production code never imports it directly.
 *
 * Documents are typed as `Record<string, unknown>` so that test fixtures can
 * include intentionally malformed shapes (e.g. missing `_id`) without resorting
 * to unsafe casts. The runtime check below enforces that every yielded document
 * has a string `_id`.
 */
export type FakeSourceData = Partial<Record<SpCollectionName, readonly Record<string, unknown>[]>>;

/**
 * Extended fake-source options that let tests include collection names the
 * engine does not iterate (e.g., `friends`, `pendingFriendRequests`). Those
 * names surface through `listCollections()` so the engine can exercise its
 * dropped-collection warning path without needing real source data. The
 * engine never calls `iterate()` with an unknown name, so we only need the
 * name to appear in the list.
 */
export interface FakeSourceOptions {
  /** Extra top-level collection names that `listCollections()` reports. */
  readonly extraCollections?: readonly string[];
}

export function createFakeImportSource(
  data: FakeSourceData,
  options: FakeSourceOptions = {},
): ImportDataSource {
  const extraCollections = options.extraCollections ?? [];
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
            `FakeImportDataSource: ${collection} document is missing _id (got ${JSON.stringify(document)})`,
          );
        }
        yield {
          collection,
          sourceId: rawId,
          document,
        };
      }
    },
    listCollections() {
      // Report every populated SP collection in `data` plus any extras the
      // caller explicitly injected. We expose keys of `data` verbatim so
      // the test helper behaves like a real source (`Object.keys` of the
      // top-level JSON).
      const names: string[] = [];
      for (const key of Object.keys(data)) {
        names.push(key);
      }
      for (const extra of extraCollections) {
        names.push(extra);
      }
      return Promise.resolve(names);
    },
    async close() {
      // no-op
    },
  };
}
