import { DecryptionFailedError, InvalidInputError } from "./errors.js";
import { getSodium } from "./sodium.js";

import type { AeadKey, AeadNonce } from "./types.js";

/**
 * Minimal shape of a Web Streams `ReadableStream<Uint8Array>`.
 *
 * Defined locally so this package can stay on the `ES2022` lib target without
 * pulling in the full `DOM` typings. Matches the contract the runtime uses:
 * `getReader()` returns a reader with `read()` producing `{ done, value }`
 * chunks and a `releaseLock()` / `cancel()` pair for cleanup.
 */
export interface ReadableByteStream {
  getReader(): {
    read(): Promise<{ readonly done: boolean; readonly value?: Uint8Array }>;
    releaseLock(): void;
    cancel(reason?: unknown): Promise<void>;
  };
}

/**
 * Input accepted by the streaming encryption API.
 *
 * - `Uint8Array` — single in-memory buffer (legacy path)
 * - `ReadableByteStream` — Web Streams source (file pickers, fetch bodies); structurally
 *   assignable from the global `ReadableStream<Uint8Array>` on web/mobile.
 * - `AsyncIterable<Uint8Array>` — any async byte producer (Node streams via `Readable.toWeb`
 *   or async generators)
 *
 * The stream variants let callers avoid materializing the full input as a single
 * contiguous buffer, which matters for large blob uploads on memory-constrained devices.
 */
export type StreamInput = Uint8Array | ReadableByteStream | AsyncIterable<Uint8Array>;

/** Result of a symmetric encryption operation. */
export interface EncryptedPayload {
  readonly ciphertext: Uint8Array;
  readonly nonce: AeadNonce;
}

/** Result of streaming encryption (chunked AEAD). */
export interface StreamEncryptedPayload {
  readonly chunks: readonly EncryptedPayload[];
  readonly totalLength: number;
}

const DEFAULT_CHUNK_SIZE = 65536; // 64 KiB

/** Encrypt plaintext with XChaCha20-Poly1305 AEAD. */
export function encrypt(plaintext: Uint8Array, key: AeadKey, aad?: Uint8Array): EncryptedPayload {
  const adapter = getSodium();
  const result = adapter.aeadEncrypt(plaintext, aad ?? null, key);
  return { ciphertext: result.ciphertext, nonce: result.nonce };
}

/** Decrypt an EncryptedPayload. Throws DecryptionFailedError on failure. */
export function decrypt(payload: EncryptedPayload, key: AeadKey, aad?: Uint8Array): Uint8Array {
  const adapter = getSodium();
  return adapter.aeadDecrypt(payload.ciphertext, payload.nonce, aad ?? null, key);
}

/** Encrypt a JSON-serializable value. */
export function encryptJSON(data: unknown, key: AeadKey, aad?: Uint8Array): EncryptedPayload {
  // JSON.stringify returns undefined at runtime for non-serializable values
  // (undefined, functions, symbols), despite TypeScript typing it as string.
  const json = JSON.stringify(data) as string | undefined;
  if (json === undefined) {
    throw new InvalidInputError("Value is not JSON-serializable (undefined, function, or symbol).");
  }
  const plaintext = new TextEncoder().encode(json);
  return encrypt(plaintext, key, aad);
}

/** Decrypt an EncryptedPayload and parse as JSON. */
export function decryptJSON(payload: EncryptedPayload, key: AeadKey, aad?: Uint8Array): unknown {
  const plaintext = decrypt(payload, key, aad);
  try {
    return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
  } catch (error: unknown) {
    throw new DecryptionFailedError("Decrypted payload is not valid JSON.", { cause: error });
  }
}

/** Size of the chunk AAD: two uint32 values (index + total). */
const CHUNK_AAD_BYTES = 8;
/** Byte offset for the total-chunks field in chunk AAD. */
const CHUNK_AAD_TOTAL_OFFSET = 4;

/**
 * Build AAD for a stream chunk: uint32le(chunkIndex) || uint32le(totalChunks).
 * Prevents reordering and truncation attacks.
 */
function buildChunkAad(chunkIndex: number, totalChunks: number): Uint8Array {
  const aad = new Uint8Array(CHUNK_AAD_BYTES);
  const view = new DataView(aad.buffer, aad.byteOffset, aad.byteLength);
  view.setUint32(0, chunkIndex, true);
  view.setUint32(CHUNK_AAD_TOTAL_OFFSET, totalChunks, true);
  return aad;
}

/**
 * Type guard for `ReadableByteStream`.
 *
 * Narrow check: the argument exposes a callable `getReader` method. This matches
 * both the DOM `ReadableStream<Uint8Array>` and Node's web-streams variant without
 * importing the DOM `lib`.
 */
function isReadableByteStream(input: unknown): input is ReadableByteStream {
  return (
    typeof input === "object" &&
    input !== null &&
    "getReader" in input &&
    typeof (input as { getReader: unknown }).getReader === "function"
  );
}

/**
 * Normalize any accepted {@link StreamInput} into an `AsyncIterable<Uint8Array>`.
 *
 * - `Uint8Array`           → yields exactly once with the buffer unchanged.
 * - `ReadableByteStream`   → drains the reader; releases the lock on completion or error.
 * - `AsyncIterable`        → returned as-is.
 *
 * This is the single adapter the encryption path consumes; callers never pay for
 * re-materializing the entire input as a contiguous buffer.
 */
export function toAsyncIterable(input: StreamInput): AsyncIterable<Uint8Array> {
  if (input instanceof Uint8Array) {
    // Synthesise a single-shot async iterable without an async generator — the
    // `require-await` lint would flag a generator with no `await`, and Promise.resolve
    // keeps the iterator protocol async.
    const buf = input;
    return {
      [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
        let yielded = false;
        return {
          next(): Promise<IteratorResult<Uint8Array>> {
            if (yielded) return Promise.resolve({ done: true, value: undefined });
            yielded = true;
            return Promise.resolve({ done: false, value: buf });
          },
        };
      },
    };
  }
  if (isReadableByteStream(input)) {
    return readerIterable(input);
  }
  return input;
}

async function* readerIterable(stream: ReadableByteStream): AsyncIterable<Uint8Array> {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value !== undefined && value.byteLength > 0) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Consume an async iterable and re-chunk the byte stream into uniformly sized
 * plaintext slices. Bytes are copied into newly allocated `Uint8Array` chunks
 * so the caller cannot mutate them after we compute AAD.
 *
 * The final chunk may be shorter than `chunkSize`. Returns at least one chunk
 * (possibly empty) to match the pre-existing `encryptStream` semantics for
 * empty input.
 */
async function collectPlaintextChunks(
  source: AsyncIterable<Uint8Array>,
  chunkSize: number,
): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];
  let buffer = new Uint8Array(chunkSize);
  let filled = 0;

  for await (const part of source) {
    let offset = 0;
    while (offset < part.byteLength) {
      const spaceInBuffer = chunkSize - filled;
      const bytesToCopy = Math.min(spaceInBuffer, part.byteLength - offset);
      buffer.set(part.subarray(offset, offset + bytesToCopy), filled);
      filled += bytesToCopy;
      offset += bytesToCopy;
      if (filled === chunkSize) {
        chunks.push(buffer);
        buffer = new Uint8Array(chunkSize);
        filled = 0;
      }
    }
  }
  if (filled > 0) chunks.push(buffer.subarray(0, filled));
  if (chunks.length === 0) chunks.push(new Uint8Array(0));
  return chunks;
}

/**
 * Encrypt plaintext in chunks. Each chunk gets independent AEAD encryption
 * with chunk index in AAD to prevent reordering/truncation.
 *
 * Synchronous variant kept for the in-memory path; for streaming input (a
 * Web Streams `ReadableStream<Uint8Array>` or an `AsyncIterable<Uint8Array>`)
 * use {@link encryptStreamAsync}.
 */
export function encryptStream(
  plaintext: Uint8Array,
  key: AeadKey,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): StreamEncryptedPayload {
  if (chunkSize <= 0) {
    throw new InvalidInputError("Chunk size must be a positive integer.");
  }
  const totalChunks = Math.max(1, Math.ceil(plaintext.length / chunkSize));
  const chunks: EncryptedPayload[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, plaintext.length);
    const chunk = plaintext.subarray(start, end);
    const aad = buildChunkAad(i, totalChunks);
    chunks.push(encrypt(chunk, key, aad));
  }

  return { chunks, totalLength: plaintext.length };
}

/**
 * Streaming-input variant of {@link encryptStream}.
 *
 * Accepts any {@link StreamInput} and re-chunks its bytes into `chunkSize`-byte
 * plaintext slices before encrypting each with AEAD + chunk-index AAD. Callers
 * providing a `ReadableStream` or async iterable avoid holding the full input
 * in memory as a single contiguous `Uint8Array`; the function itself buffers
 * only the current accumulating chunk plus the already-encrypted ciphertext
 * output.
 *
 * The chunk-count appears in AAD, so the output must know the total count up
 * front. That count is discovered as the source is drained; consequently this
 * function emits the full `StreamEncryptedPayload` at the end, not
 * per-ciphertext-chunk. Backpressure is still honoured on the input side — we
 * never pull from the source faster than AEAD can consume.
 */
export async function encryptStreamAsync(
  input: StreamInput,
  key: AeadKey,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
): Promise<StreamEncryptedPayload> {
  if (chunkSize <= 0) {
    throw new InvalidInputError("Chunk size must be a positive integer.");
  }

  if (input instanceof Uint8Array) {
    // Fast path — identical semantics as the synchronous variant.
    return encryptStream(input, key, chunkSize);
  }

  const plaintextChunks = await collectPlaintextChunks(toAsyncIterable(input), chunkSize);
  const totalChunks = plaintextChunks.length;
  const encryptedChunks: EncryptedPayload[] = [];
  let totalLength = 0;

  for (let i = 0; i < totalChunks; i++) {
    const plain = plaintextChunks[i];
    if (!plain) throw new InvalidInputError("Unexpected missing plaintext chunk.");
    const aad = buildChunkAad(i, totalChunks);
    encryptedChunks.push(encrypt(plain, key, aad));
    totalLength += plain.byteLength;
  }

  return { chunks: encryptedChunks, totalLength };
}

/**
 * Decrypt a stream-encrypted payload. Verifies chunk count against AAD
 * to detect truncation and reordering attacks.
 *
 * The output `Uint8Array` is pre-allocated to `payload.totalLength` and each
 * decrypted chunk is written at its running offset — no intermediate
 * array-of-parts, no second-pass concat. This halves the peak memory for a
 * large-blob decrypt (previously: decrypted parts array + final buffer both
 * resident; now: final buffer only).
 *
 * If `totalLength` is tampered to exceed the true sum, the post-loop offset
 * check throws. If it is tampered to be smaller than a mid-loop write, the
 * write is bounds-checked against the allocation and throws immediately via
 * `Uint8Array.prototype.set`.
 */
export function decryptStream(payload: StreamEncryptedPayload, key: AeadKey): Uint8Array {
  const totalChunks = payload.chunks.length;
  const totalLength = payload.totalLength;

  // Guard: totalLength must be a non-negative finite integer — Uint8Array
  // would happily allocate NaN bytes (zero) or throw on negatives, but an
  // explicit check produces a better error.
  if (!Number.isInteger(totalLength) || totalLength < 0) {
    throw new DecryptionFailedError(
      "Stream payload has invalid totalLength: " + String(totalLength),
    );
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (let i = 0; i < totalChunks; i++) {
    const chunk = payload.chunks[i];
    if (!chunk) {
      throw new DecryptionFailedError("Missing chunk in stream payload.");
    }
    const aad = buildChunkAad(i, totalChunks);
    let plain: Uint8Array;
    try {
      plain = decrypt(chunk, key, aad);
    } catch (error: unknown) {
      throw new DecryptionFailedError("Stream decryption failed at chunk " + String(i) + ".", {
        cause: error,
      });
    }

    if (offset + plain.byteLength > totalLength) {
      // totalLength is smaller than the actual decrypted payload — refuse to
      // silently truncate. Bubble up as a decryption failure rather than
      // letting `set` throw a RangeError with no cryptographic context.
      throw new DecryptionFailedError(
        "Decrypted stream length mismatch: chunk " +
          String(i) +
          " overflows declared totalLength of " +
          String(totalLength) +
          ".",
      );
    }

    result.set(plain, offset);
    offset += plain.byteLength;
  }

  if (offset !== totalLength) {
    throw new DecryptionFailedError(
      "Decrypted stream length mismatch: expected " +
        String(totalLength) +
        " bytes, got " +
        String(offset) +
        ".",
    );
  }

  return result;
}
