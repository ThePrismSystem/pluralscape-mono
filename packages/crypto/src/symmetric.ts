import { DecryptionFailedError, InvalidInputError } from "./errors.js";
import { getSodium } from "./sodium.js";

import type { AeadKey, AeadNonce } from "./types.js";

/**
 * Minimal shape of a Web Streams `ReadableStream<Uint8Array>`.
 *
 * Defined locally so this package can stay on the `ES2022` lib target without
 * pulling in the full `DOM` typings. The `read()` result is a discriminated
 * union so `done: true` cannot coexist with a present `value`, which matches
 * the Streams spec and removes the optional-value trap at the call site.
 */
export interface ReadableByteStream {
  getReader(): {
    read(): Promise<
      | { readonly done: true; readonly value?: undefined }
      | { readonly done: false; readonly value: Uint8Array }
    >;
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

/**
 * Upper bound on a stream payload's declared totalLength in bytes.
 *
 * Matches the `u32` width of the on-wire serializer (blob-pipeline), so a
 * header that exceeds this value could not have been produced by our
 * encryptor and is treated as an attack.
 */
export const MAX_DECRYPT_STREAM_BYTES = 0xffffffff;

/**
 * Upper bound on a single plaintext chunk after re-chunking, in bytes (16 MiB).
 *
 * Used only by `decryptStream`'s cross-check: `totalLength` must not exceed
 * `chunks.length * MAX_PLAINTEXT_CHUNK_BYTES`, so an attacker cannot submit a
 * one-chunk payload with a multi-GiB `totalLength` to force a huge allocation.
 */
export const MAX_PLAINTEXT_CHUNK_BYTES = 16_777_216;

/**
 * Upper bound on the number of chunks in a stream payload.
 *
 * 65_536 chunks × 16 MiB plaintext/chunk ≈ 1 TiB — far above any legitimate
 * blob size, but far below what an attacker could use to exhaust memory.
 */
export const MAX_STREAM_CHUNKS = 65_536;

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
 * Narrow check: the argument exposes a callable `getReader` method. The
 * `"getReader" in input` check narrows `input` to an object with an unknown
 * `getReader` field, so no additional cast is required.
 */
function isReadableByteStream(input: unknown): input is ReadableByteStream {
  return (
    typeof input === "object" &&
    input !== null &&
    "getReader" in input &&
    typeof input.getReader === "function"
  );
}

/**
 * Normalize a streaming source into an `AsyncIterable<Uint8Array>`.
 *
 * - `ReadableByteStream`   → drains the reader; releases the lock on normal
 *                            completion, and cancels the reader on error or
 *                            early termination so the upstream producer
 *                            (fetch body, file handle, ...) can free buffers.
 * - `AsyncIterable`        → returned as-is.
 *
 * `Uint8Array` inputs are handled by the `encryptStreamAsync` fast path
 * before this helper is called, so the helper only deals with genuinely
 * streaming inputs.
 */
export function toAsyncIterable(
  input: ReadableByteStream | AsyncIterable<Uint8Array>,
): AsyncIterable<Uint8Array> {
  if (isReadableByteStream(input)) {
    return readerIterable(input);
  }
  return input;
}

async function* readerIterable(stream: ReadableByteStream): AsyncIterable<Uint8Array> {
  const reader = stream.getReader();
  let normalCompletion = false;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) {
        normalCompletion = true;
        return;
      }
      if (result.value.byteLength > 0) yield result.value;
    }
  } finally {
    if (!normalCompletion) {
      // Signal the upstream producer that we abandoned the read so it can
      // release any pending buffers. Suppress any cancel rejection — we are
      // already unwinding a prior failure and must not mask it.
      await reader.cancel().catch((): void => undefined);
    }
    reader.releaseLock();
  }
}

/**
 * Consume an async iterable and re-chunk the byte stream into uniformly sized
 * plaintext slices.
 *
 * Completed chunks are freshly allocated `Uint8Array`s (the source cannot
 * mutate them after we compute AAD). The final partial chunk is a
 * `buffer.subarray(...)` view aliasing `buffer`, so no extra allocation is
 * made for it.
 *
 * On any error thrown by the source or by copying, every collected chunk —
 * plus the in-flight `buffer` — is memzero'd before the error is re-thrown,
 * so no plaintext outlives the aborted call.
 *
 * The final chunk may be shorter than `chunkSize`. Returns at least one chunk
 * (possibly empty) to match `encryptStream`'s semantics for empty input.
 */
async function collectPlaintextChunks(
  source: AsyncIterable<Uint8Array>,
  chunkSize: number,
): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];
  let buffer = new Uint8Array(chunkSize);
  let filled = 0;

  try {
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
  } catch (error: unknown) {
    const adapter = getSodium();
    for (const chunk of chunks) adapter.memzero(chunk);
    adapter.memzero(buffer);
    throw error;
  }
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
  const totalChunks = Math.max(1, Math.ceil(plaintext.byteLength / chunkSize));
  const chunks: EncryptedPayload[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, plaintext.byteLength);
    const chunk = plaintext.subarray(start, end);
    const aad = buildChunkAad(i, totalChunks);
    chunks.push(encrypt(chunk, key, aad));
  }

  return { chunks, totalLength: plaintext.byteLength };
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
 *
 * Plaintext chunks are memzero'd once their ciphertext is produced (both
 * success and error paths), so plaintext does not outlive the ciphertext it
 * produced.
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
  const adapter = getSodium();
  try {
    const totalChunks = plaintextChunks.length;
    const encryptedChunks = plaintextChunks.map((plain, i) =>
      encrypt(plain, key, buildChunkAad(i, totalChunks)),
    );
    const totalLength = plaintextChunks.reduce((n, p) => n + p.byteLength, 0);
    return { chunks: encryptedChunks, totalLength };
  } finally {
    for (const chunk of plaintextChunks) adapter.memzero(chunk);
  }
}

/**
 * Decrypt a stream-encrypted payload. Verifies chunk count against AAD
 * to detect truncation and reordering attacks.
 *
 * The output `Uint8Array` is pre-allocated to `payload.totalLength` and each
 * decrypted chunk is written at its running offset — no intermediate
 * array-of-parts, no second-pass concat.
 *
 * Before allocation, three impossible-payload guards reject malicious headers:
 *   1. `totalLength` is a non-negative integer no larger than
 *      `MAX_DECRYPT_STREAM_BYTES` (the on-wire `u32` maximum).
 *   2. `chunks.length` does not exceed `MAX_STREAM_CHUNKS`.
 *   3. `totalLength` does not exceed `chunks.length * MAX_PLAINTEXT_CHUNK_BYTES`
 *      — rejects small-chunk / huge-length headers that would force a
 *      multi-GiB allocation.
 *
 * If `totalLength` is tampered to exceed the true sum, the post-loop offset
 * check throws. If it is tampered to be smaller than a mid-loop write, the
 * bounds check throws immediately before `Uint8Array.prototype.set`.
 */
export function decryptStream(payload: StreamEncryptedPayload, key: AeadKey): Uint8Array {
  const totalChunks = payload.chunks.length;
  const totalLength = payload.totalLength;

  if (!Number.isInteger(totalLength) || totalLength < 0) {
    throw new DecryptionFailedError(
      "Stream payload has invalid totalLength: " + String(totalLength),
    );
  }
  if (totalLength > MAX_DECRYPT_STREAM_BYTES) {
    throw new DecryptionFailedError(
      "Stream payload totalLength " +
        String(totalLength) +
        " exceeds supported maximum of " +
        String(MAX_DECRYPT_STREAM_BYTES) +
        " bytes.",
    );
  }
  if (totalChunks > MAX_STREAM_CHUNKS) {
    throw new DecryptionFailedError(
      "Stream payload chunk count " +
        String(totalChunks) +
        " exceeds supported maximum of " +
        String(MAX_STREAM_CHUNKS) +
        ".",
    );
  }
  if (totalLength > totalChunks * MAX_PLAINTEXT_CHUNK_BYTES) {
    throw new DecryptionFailedError(
      "Stream payload totalLength " +
        String(totalLength) +
        " exceeds what " +
        String(totalChunks) +
        " chunks can carry (" +
        String(MAX_PLAINTEXT_CHUNK_BYTES) +
        " bytes per chunk).",
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
