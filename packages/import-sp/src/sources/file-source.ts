import clarinet from "clarinet";

import { isSpCollectionName, type SpCollectionName } from "./sp-collections.js";

import type { ImportSource, SourceDocument } from "./source.types.js";

/** Input shape for `createFileImportSource`. */
export interface FileSourceInput {
  /** Raw bytes of the SP JSON export. Mobile callers convert a Blob to bytes first. */
  readonly jsonBytes: Uint8Array;
}

/**
 * A container tracked while streaming the JSON. Each frame on the stack is the
 * container we are currently building up, plus the key pending assignment when
 * that container is an object.
 */
interface Frame {
  container: Record<string, unknown> | unknown[];
  pendingKey: string | null;
}

/**
 * Assign `value` into the container at the top of the stack. For arrays, push;
 * for objects, set under `pendingKey` and clear it. No-op if the stack is empty
 * (which only happens when the value is the root of the document).
 */
function assignToTop(stack: Frame[], value: unknown): void {
  if (stack.length === 0) {
    return;
  }
  const top = stack[stack.length - 1];
  if (top === undefined) {
    return;
  }
  if (Array.isArray(top.container)) {
    top.container.push(value);
    return;
  }
  if (top.pendingKey === null) {
    // Programming error — onvalue fired on an object without a pending key.
    throw new Error("FileImportSource: onvalue fired on object with no pending key");
  }
  top.container[top.pendingKey] = value;
  top.pendingKey = null;
}

/**
 * Build a `Map<collection, document[]>` from raw export bytes by streaming the
 * JSON via clarinet. Only top-level keys matching `SP_COLLECTION_NAMES` are
 * retained; other top-level keys are still structurally consumed but not stored.
 *
 * Throws synchronously on JSON parse failure or on a document missing `_id`.
 */
function parseExportBytes(jsonBytes: Uint8Array): Map<SpCollectionName, unknown[]> {
  const parser = clarinet.parser();
  const result = new Map<SpCollectionName, unknown[]>();

  // The stack tracks the path from the root into the current container. It
  // starts empty; the first open-object or open-array event installs the root.
  // Mutable state lives inside `state` so TypeScript's control-flow analysis
  // doesn't narrow fields to their initial values across callback boundaries.
  const state: {
    root: Record<string, unknown> | unknown[] | null;
    parseError: Error | null;
  } = { root: null, parseError: null };
  const stack: Frame[] = [];

  parser.onopenobject = (firstKey?: string): void => {
    const obj: Record<string, unknown> = {};
    if (stack.length === 0) {
      state.root = obj;
    } else {
      assignToTop(stack, obj);
    }
    stack.push({ container: obj, pendingKey: firstKey ?? null });
  };

  parser.oncloseobject = (): void => {
    stack.pop();
  };

  parser.onopenarray = (): void => {
    const arr: unknown[] = [];
    if (stack.length === 0) {
      state.root = arr;
    } else {
      assignToTop(stack, arr);
    }
    stack.push({ container: arr, pendingKey: null });
  };

  parser.onclosearray = (): void => {
    stack.pop();
  };

  parser.onkey = (key: string): void => {
    const top = stack[stack.length - 1];
    if (top !== undefined && !Array.isArray(top.container)) {
      top.pendingKey = key;
    }
  };

  parser.onvalue = (value: string | number | boolean | null): void => {
    assignToTop(stack, value);
  };

  parser.onerror = (err: Error): void => {
    state.parseError = err;
  };

  // clarinet accepts a UTF-8 string. Decode the bytes once up front; for the
  // 50MB import budget this is ~50MB of peak transient string memory, which is
  // acceptable on mobile and avoids chunk-boundary UTF-8 issues. The default
  // encoding for TextDecoder is utf-8, matching the SP export format.
  const text = new TextDecoder().decode(jsonBytes);
  const writeHolder: { thrown: Error | null } = { thrown: null };
  try {
    parser.write(text);
    parser.close();
  } catch (err) {
    writeHolder.thrown = err instanceof Error ? err : new Error(String(err));
  }

  // Prefer the error captured via `onerror` (clarinet sets it before throwing),
  // falling back to anything thrown synchronously by write/close.
  const effectiveError = state.parseError ?? writeHolder.thrown;
  if (effectiveError !== null) {
    throw effectiveError;
  }

  // A valid SP export is always a JSON object at the root. An empty document
  // (`{}` or no root at all) produces an empty result.
  const rootValue = state.root;
  if (rootValue === null) {
    return result;
  }
  if (Array.isArray(rootValue)) {
    throw new Error("FileImportSource: expected JSON object at root, got array");
  }

  // Extract only SP collections from the root. Other top-level keys (e.g. an
  // unexpected "schemaVersion") are silently dropped — validation happens later
  // in the engine against the per-collection Zod schema.
  for (const [key, value] of Object.entries(rootValue)) {
    if (!isSpCollectionName(key)) {
      continue;
    }
    if (!Array.isArray(value)) {
      continue;
    }
    for (const doc of value) {
      if (doc === null || typeof doc !== "object") {
        throw new Error(
          `FileImportSource: ${key} contained a non-object document (got ${typeof doc})`,
        );
      }
      const id = (doc as { _id?: unknown })._id;
      if (typeof id !== "string" || id.length === 0) {
        throw new Error(
          `FileImportSource: ${key} document is missing _id (got ${JSON.stringify(doc)})`,
        );
      }
    }
    result.set(key, value);
  }

  return result;
}

/**
 * Build a file-backed `ImportSource` from raw SP JSON export bytes.
 *
 * The constructor eagerly parses the input via clarinet into an in-memory
 * index keyed by collection name. This is "parse once, iterate many": subsequent
 * calls to `iterate()` walk the cached array so re-iteration is deterministic
 * and cheap. The async signature reserves the option to switch to a true
 * streaming pull-parser later without changing the engine API.
 *
 * Throws synchronously (via the rejected promise) on malformed JSON or on a
 * document missing `_id`.
 */
export function createFileImportSource(input: FileSourceInput): Promise<ImportSource> {
  // Wrap in a resolved/rejected promise — the parse itself is synchronous, but
  // the API is async so callers can swap in a streaming implementation later.
  return new Promise<ImportSource>((resolve, reject) => {
    let indexed: Map<SpCollectionName, unknown[]>;
    try {
      indexed = parseExportBytes(input.jsonBytes);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    const source: ImportSource = {
      mode: "file",
      async *iterate(collection: SpCollectionName): AsyncGenerator<SourceDocument> {
        // Yield to the microtask queue so the iterator is reliably async.
        await Promise.resolve();
        const docs = indexed.get(collection) ?? [];
        for (const document of docs) {
          const sourceId = (document as { _id?: unknown })._id;
          if (typeof sourceId !== "string" || sourceId.length === 0) {
            // parseExportBytes already validated _id, but we re-check at
            // iterate-time so the async path cannot accidentally leak an
            // invalid document.
            throw new Error(`FileImportSource: ${collection} document missing _id at iterate-time`);
          }
          yield { collection, sourceId, document };
        }
      },
      async close(): Promise<void> {
        // No held resources — parsing happened eagerly in the constructor.
      },
    };
    resolve(source);
  });
}
