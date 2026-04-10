import type { SpCollectionName } from "./sp-collections.js";

/** Discriminator for which kind of source is producing documents. */
export type SourceMode = "api" | "file" | "fake";

/**
 * A single document yielded by an `ImportDataSource`.
 *
 * `document` is intentionally `unknown` — the engine validates it against the
 * corresponding Zod schema before passing it to a mapper. Sources never validate.
 */
export interface SourceDocument {
  readonly collection: SpCollectionName;
  readonly sourceId: string;
  readonly document: unknown;
}

/**
 * Streams Simply Plural documents grouped by collection.
 *
 * Implementations:
 * - `FileImportSource` — streams from a local JSON export (+ optional avatar ZIP).
 * - `ApiImportSource` — paginates Simply Plural API endpoints with a bearer token.
 * - `FakeImportSource` — in-memory backed by a JS object, used in tests.
 *
 * Contract:
 * - `iterate(collection)` yields documents in source-emission order. Sources MUST
 *   produce a stable order across calls so the engine's checkpoint
 *   `currentCollectionLastSourceId` is meaningful.
 * - `listCollections()` returns the names of every top-level collection the
 *   source can yield. The engine compares this against its known collections
 *   and emits a `dropped-collection` warning for any name it does not iterate.
 *   Names need not be valid {@link SpCollectionName} values — returning an
 *   unknown name is exactly the signal the engine uses to warn.
 * - Network or parse errors are surfaced as exceptions; the engine catches them
 *   and classifies them per its error policy.
 * - `close()` releases any held resources (file handles, sockets). Idempotent.
 */
export interface ImportDataSource {
  readonly mode: SourceMode;
  iterate(collection: SpCollectionName): AsyncIterable<SourceDocument>;
  listCollections(): Promise<readonly string[]>;
  close(): Promise<void>;
}
