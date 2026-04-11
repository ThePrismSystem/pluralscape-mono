/**
 * Streaming file-based SP import source.
 *
 * Drives clarinet's SAX-style parser via chunks from a web ReadableStream.
 * The accumulator stack reconstructs nested SP documents and yields each
 * top-level collection element as a SourceDocument once it closes.
 *
 * Chunk-boundary safety:
 * - TextDecoder("utf-8", { fatal: true }) with { stream: true } buffers
 *   multibyte UTF-8 sequences split across chunks.
 * - clarinet internally buffers partial tokens across write() calls.
 *
 * Memory characteristics: despite the SAX parser, the prescan pass
 * reconstructs the full SP document tree in memory (`documentsByCollection`
 * holds every collection element as a plain object) before `iterate()` is
 * first called. Peak resident memory is therefore O(file_size) — roughly
 * 2-3x the input file size once JS object overhead is included. This is
 * acceptable for typical personal exports (tens of MB) but unsuitable for
 * multi-GB inputs. A future optimization is to switch prescan to a bounded
 * queue and yield documents as they close, so only one collection is ever
 * materialized at a time; that refactor is gated on the engine consuming
 * documents faster than the parser can produce them.
 *
 * Error policy: no recovery. On any parse error FileSourceParseError is thrown
 * with the byte position from the parser.
 */
import clarinet from "clarinet";

import { toRecord } from "../shared/to-record.js";

import { isSpCollectionName, type SpCollectionName } from "./sp-collections.js";

import type { ImportDataSource, SourceDocument } from "./source.types.js";

export class FileSourceParseError extends Error {
  public readonly position: number | null;
  constructor(message: string, position: number | null, options?: ErrorOptions) {
    const suffix = position === null ? "" : ` (at byte ${String(position)})`;
    super(`${message}${suffix}`, options);
    this.name = "FileSourceParseError";
    this.position = position;
  }
}

type StackFrame =
  | { kind: "object"; value: Record<string, unknown>; currentKey: string | undefined }
  | { kind: "array"; value: unknown[] };

export interface FileImportSourceArgs {
  readonly stream: ReadableStream<Uint8Array>;
}

interface PrescanState {
  readonly topLevelKeys: readonly string[];
  readonly documentsByCollection: ReadonlyMap<string, readonly unknown[]>;
}

/**
 * Wrap an unknown thrown value as a FileSourceParseError, preserving it as cause.
 * Used at the clarinet/TextDecoder boundary where we cannot predict the error shape.
 */
function wrapParseError(err: unknown, position: number): FileSourceParseError {
  const message = err instanceof Error ? err.message : String(err);
  return new FileSourceParseError(message, position, { cause: err });
}

export function createFileImportSource(args: FileImportSourceArgs): ImportDataSource {
  let prescan: PrescanState | null = null;

  async function parseStream(): Promise<PrescanState> {
    if (prescan !== null) return prescan;

    const decoder = new TextDecoder("utf-8", { fatal: true });
    const parser = clarinet.parser();

    const stack: StackFrame[] = [];
    // Pending parse error set inside SAX callbacks; checked after each write().
    // Stored as a container so TypeScript's control-flow can narrow it after
    // the null check (direct `let parseError: Error | null` is not narrowed
    // across closure boundaries).
    const pending: { error: FileSourceParseError | null } = { error: null };
    let currentTopKey: string | null = null;
    const documentsByCollection = new Map<string, unknown[]>();
    const topLevelKeys: string[] = [];
    /** Keys whose values were arrays (may be empty). Distinguishes empty arrays from non-array values. */
    const arrayValuedKeys = new Set<string>();

    /**
     * Assign `value` into the container at the top of the stack.
     * Called for all values except top-level collection documents (handled in
     * oncloseobject).
     */
    function assignToParent(value: unknown): void {
      const parent = stack[stack.length - 1];
      if (parent === undefined) {
        pending.error = new FileSourceParseError("Expected JSON object at root", parser.position);
        return;
      }
      if (parent.kind === "object") {
        if (parent.currentKey === undefined) {
          pending.error = new FileSourceParseError(
            "Value without key inside object",
            parser.position,
          );
          return;
        }
        parent.value[parent.currentKey] = value;
      } else {
        parent.value.push(value);
      }
    }

    parser.onerror = (err) => {
      pending.error = new FileSourceParseError(err.message, parser.position, { cause: err });
    };

    parser.onvalue = (v) => {
      if (pending.error !== null) return;
      // Record root-level scalar keys (e.g. "schemaVersion": 2) in topLevelKeys.
      if (stack.length === 1) {
        const parent = stack[0];
        if (parent?.kind === "object" && parent.currentKey !== undefined) {
          topLevelKeys.push(parent.currentKey);
        }
      }
      assignToParent(v);
    };

    parser.onopenobject = (firstKey) => {
      if (pending.error !== null) return;
      // Record every root-level key so listCollections can surface non-array values too.
      if (stack.length === 1) {
        const parent = stack[0];
        if (parent?.kind === "object" && parent.currentKey !== undefined) {
          topLevelKeys.push(parent.currentKey);
        }
      }
      stack.push({ kind: "object", value: {}, currentKey: firstKey });
    };

    parser.onkey = (key) => {
      if (pending.error !== null) return;
      const top = stack[stack.length - 1];
      if (top?.kind !== "object") {
        pending.error = new FileSourceParseError("Unexpected key outside object", parser.position);
        return;
      }
      top.currentKey = key;
    };

    parser.oncloseobject = () => {
      if (pending.error !== null) return;
      const popped = stack.pop();
      if (popped?.kind !== "object") {
        pending.error = new FileSourceParseError("Mismatched oncloseobject", parser.position);
        return;
      }
      // Root object closing — nothing to assign to.
      if (stack.length === 0) return;
      // At depth 2 (stack now has root-object + collection-array) this is a
      // top-level collection document. Store it and return — do NOT call
      // assignToParent because the array is tracked via documentsByCollection.
      if (stack.length === 2 && currentTopKey !== null) {
        let bucket = documentsByCollection.get(currentTopKey);
        if (bucket === undefined) {
          bucket = [];
          documentsByCollection.set(currentTopKey, bucket);
        }
        bucket.push(popped.value);
        return;
      }
      assignToParent(popped.value);
    };

    parser.onopenarray = () => {
      if (pending.error !== null) return;
      // Entering a top-level collection array: record the key in topLevelKeys.
      if (stack.length === 1) {
        const parent = stack[0];
        if (parent?.kind === "object" && parent.currentKey !== undefined) {
          currentTopKey = parent.currentKey;
          topLevelKeys.push(parent.currentKey);
          arrayValuedKeys.add(parent.currentKey);
        }
      }
      stack.push({ kind: "array", value: [] });
    };

    parser.onclosearray = () => {
      if (pending.error !== null) return;
      const popped = stack.pop();
      if (popped?.kind !== "array") {
        pending.error = new FileSourceParseError("Mismatched onclosearray", parser.position);
        return;
      }
      // Root was an array — SP exports require an object root.
      if (stack.length === 0) {
        pending.error = new FileSourceParseError(
          "Expected JSON object at root, got array",
          parser.position,
        );
        return;
      }
      // Closing a top-level collection array — reset currentTopKey.
      if (stack.length === 1 && currentTopKey !== null) {
        currentTopKey = null;
        return;
      }
      assignToParent(popped.value);
    };

    // Consume the stream chunk by chunk.
    const reader = args.stream.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        parser.write(text);
        if (pending.error !== null) throw pending.error;
      }
      // Flush any incomplete multibyte sequence buffered by the decoder.
      const tail = decoder.decode();
      parser.write(tail);
      parser.close();
      if (pending.error !== null) throw pending.error;
    } catch (err) {
      if (err instanceof FileSourceParseError) throw err;
      // Re-wrap clarinet or TextDecoder errors so callers get a uniform type.
      throw wrapParseError(err, parser.position);
    } finally {
      reader.releaseLock();
    }

    if (stack.length !== 0) {
      throw new FileSourceParseError("Unexpected end of input", parser.position);
    }

    // Validate known SP collection keys had array values. A non-array value does
    // not trigger onopenarray, so the key appears in topLevelKeys (added via
    // onopenobject/onvalue) but not in arrayValuedKeys.
    for (const key of topLevelKeys) {
      if (isSpCollectionName(key) && !arrayValuedKeys.has(key)) {
        throw new FileSourceParseError(
          `Collection "${key}" had a non-array value`,
          parser.position,
        );
      }
    }

    prescan = { topLevelKeys, documentsByCollection };
    return prescan;
  }

  return {
    mode: "file",

    /**
     * Returns the raw top-level key list from the parsed document. The
     * return type is intentionally `string[]` rather than
     * `SpCollectionName[]` — the whole point of this method is to let the
     * engine detect collection names the importer does not recognise (so
     * it can emit `dropped-collection` warnings). Narrowing to
     * `SpCollectionName[]` would require us to filter unknown names out
     * here, defeating the purpose.
     */
    async listCollections() {
      const state = await parseStream();
      return state.topLevelKeys;
    },

    async *iterate(collection: SpCollectionName): AsyncGenerator<SourceDocument> {
      const state = await parseStream();
      const docs = state.documentsByCollection.get(collection) ?? [];
      for (const doc of docs) {
        if (typeof doc !== "object" || doc === null) continue;
        const rec = toRecord(doc);
        const sourceId = typeof rec._id === "string" ? rec._id : null;
        if (sourceId === null) continue;
        yield { collection, sourceId, document: rec };
      }
    },

    async close(): Promise<void> {
      // Stream reader is released inside parseStream's finally block.
    },
  };
}
