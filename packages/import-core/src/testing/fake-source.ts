import type { ImportDataSource, SourceEvent } from "../source.types.js";

export type FakeSourceData = Partial<Record<string, readonly Record<string, unknown>[]>>;

/**
 * Extended options for the in-memory fake source.
 *
 * `extraCollections` lets tests include collection names the engine does not
 * iterate (e.g. names from an unrecognised source format). Those names surface
 * through `listCollections()` so the engine can exercise its
 * dropped-collection warning path without needing real source data.
 */
export interface FakeSourceOptions {
  /** Extra top-level collection names that `listCollections()` reports. */
  readonly extraCollections?: readonly string[];
}

/**
 * In-memory `ImportDataSource` backed by a plain JS object. Used in tests.
 *
 * Documents are typed as `Record<string, unknown>` so that test fixtures can
 * include intentionally malformed shapes (e.g. missing `_id`) without
 * resorting to unsafe casts. The runtime check enforces that every yielded
 * document has a string `_id`.
 */
export function createFakeImportSource(
  data: FakeSourceData,
  options: FakeSourceOptions = {},
): ImportDataSource {
  const extraCollections = options.extraCollections ?? [];
  return {
    mode: "fake",
    async *iterate(collection: string): AsyncGenerator<SourceEvent> {
      // Yield to the microtask queue so this conforms to async-iterator
      // semantics even though the in-memory backing store is synchronous.
      await Promise.resolve();
      const docs = data[collection] ?? [];
      for (const document of docs) {
        const rawId = document["_id"];
        if (typeof rawId !== "string" || rawId.length === 0) {
          throw new Error(
            `FakeImportDataSource: ${collection} document is missing _id (got ${JSON.stringify(document)})`,
          );
        }
        yield {
          kind: "doc",
          collection,
          sourceId: rawId,
          document,
        };
      }
    },
    listCollections(): Promise<readonly string[]> {
      const names: string[] = [];
      for (const key of Object.keys(data)) {
        names.push(key);
      }
      for (const extra of extraCollections) {
        names.push(extra);
      }
      return Promise.resolve(names);
    },
    async close(): Promise<void> {
      // no-op
    },
  };
}
