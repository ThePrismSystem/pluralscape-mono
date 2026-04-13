/** Discriminator for which kind of source is producing documents. */
export type SourceMode = "api" | "file" | "fake";

/**
 * A single event yielded by an `ImportDataSource`.
 *
 * `doc` events carry a parsed document whose `document` field is
 * intentionally `unknown` — the engine validates it against the
 * corresponding Zod schema before passing it to a mapper. Sources never
 * validate.
 *
 * `drop` events tell the engine the source knowingly rejected a document
 * before producing it (non-object body, missing `_id`, wrong-shaped single
 * response). The engine records them as non-fatal `ImportError`s with
 * `kind: "invalid-source-document"` and keeps iterating. Transport and
 * parse errors (network, SAX failure, HTTP 5xx) still throw and remain
 * fatal.
 */
export type SourceEvent =
  | {
      readonly kind: "doc";
      readonly collection: string;
      readonly sourceId: string;
      readonly document: unknown;
    }
  | {
      readonly kind: "drop";
      readonly collection: string;
      readonly sourceId: string | null;
      readonly reason: string;
    };

/**
 * Streams import documents grouped by collection.
 *
 * Implementations provide documents from a specific data source (API,
 * file export, in-memory fake for tests).
 *
 * Contract:
 * - `iterate(collection)` yields documents in source-emission order. Sources MUST
 *   produce a stable order across calls so the engine's checkpoint
 *   `currentCollectionLastSourceId` is meaningful.
 * - `listCollections()` returns the names of every top-level collection the
 *   source can yield. The engine compares this against its known collections
 *   and emits a `dropped-collection` warning for any name it does not iterate.
 * - Network or parse errors are surfaced as exceptions; the engine catches them
 *   and classifies them per its error policy.
 * - `close()` releases any held resources (file handles, sockets). Idempotent.
 */
export interface ImportDataSource {
  readonly mode: SourceMode;
  iterate(collection: string): AsyncIterable<SourceEvent>;
  listCollections(): Promise<readonly string[]>;
  close(): Promise<void>;

  /**
   * Supply source IDs from a parent collection that a dependent collection
   * needs to enumerate its per-parent endpoints. Called by the engine after
   * completing a parent collection's iteration.
   *
   * Sources that don't use dependent fetching may omit this (the engine
   * guards the call with an existence check).
   */
  supplyParentIds?(parentCollection: string, sourceIds: readonly string[]): void;
}
