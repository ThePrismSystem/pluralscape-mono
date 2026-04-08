import type { SpCollectionName } from "./sp-collections.js";

/** Discriminator for which kind of source is producing documents. */
export type SourceMode = "api" | "file" | "fake";

/**
 * A single document yielded by an `ImportSource`.
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
 * - Network or parse errors are surfaced as exceptions; the engine catches them
 *   and classifies them per its error policy.
 * - `close()` releases any held resources (file handles, sockets). Idempotent.
 */
export interface ImportSource {
  readonly mode: SourceMode;
  iterate(collection: SpCollectionName): AsyncIterable<SourceDocument>;
  close(): Promise<void>;
}
