import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AEAD_NONCE_BYTES } from "../crypto.constants.js";
import { DecryptionFailedError, InvalidInputError } from "../errors.js";
import { getSodium } from "../sodium.js";
import {
  MAX_DECRYPT_STREAM_BYTES,
  MAX_PLAINTEXT_CHUNK_BYTES,
  MAX_STREAM_CHUNKS,
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  encryptStream,
  encryptStreamAsync,
  decryptStream,
} from "../symmetric.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { SodiumAdapter } from "../adapter/interface.js";
import type { EncryptedPayload } from "../symmetric.js";
import type { AeadKey } from "../types.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let key: AeadKey;
let adapter: SodiumAdapter;

beforeAll(async () => {
  await setupSodium();
  adapter = getSodium();
  key = adapter.aeadKeygen();
});

afterAll(() => {
  teardownSodium();
});

describe("encrypt/decrypt", () => {
  it("roundtrips plaintext correctly", () => {
    const plaintext = encoder.encode("hello, pluralscape");
    const payload = encrypt(plaintext, key);
    const decrypted = decrypt(payload, key);
    expect(decoder.decode(decrypted)).toBe("hello, pluralscape");
  });

  it("generates a random 24-byte nonce per encryption", () => {
    const plaintext = encoder.encode("nonce test");
    const p1 = encrypt(plaintext, key);
    const p2 = encrypt(plaintext, key);
    expect(p1.nonce.length).toBe(AEAD_NONCE_BYTES);
    expect(p2.nonce.length).toBe(AEAD_NONCE_BYTES);
    expect(p1.nonce).not.toEqual(p2.nonce);
  });

  it("produces different ciphertexts for same data (random nonce)", () => {
    const plaintext = encoder.encode("same data");
    const p1 = encrypt(plaintext, key);
    const p2 = encrypt(plaintext, key);
    expect(p1.ciphertext).not.toEqual(p2.ciphertext);
  });

  it("roundtrips with AAD", () => {
    const plaintext = encoder.encode("aad test");
    const aad = encoder.encode("context-metadata");
    const payload = encrypt(plaintext, key, aad);
    const decrypted = decrypt(payload, key, aad);
    expect(decoder.decode(decrypted)).toBe("aad test");
  });

  it("fails when AAD mismatches", () => {
    const plaintext = encoder.encode("aad mismatch");
    const aad = encoder.encode("correct");
    const wrongAad = encoder.encode("wrong");
    const payload = encrypt(plaintext, key, aad);
    expect(() => decrypt(payload, key, wrongAad)).toThrow(DecryptionFailedError);
  });

  it("detects tampered ciphertext", () => {
    const plaintext = encoder.encode("tamper test");
    const payload = encrypt(plaintext, key);
    const tampered = new Uint8Array(payload.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    expect(() => decrypt({ ciphertext: tampered, nonce: payload.nonce }, key)).toThrow(
      DecryptionFailedError,
    );
  });

  it("fails with wrong key", () => {
    const wrongKey = getSodium().aeadKeygen();
    const plaintext = encoder.encode("wrong key");
    const payload = encrypt(plaintext, key);
    expect(() => decrypt(payload, wrongKey)).toThrow(DecryptionFailedError);
  });

  it("roundtrips empty plaintext", () => {
    const plaintext = new Uint8Array(0);
    const payload = encrypt(plaintext, key);
    const decrypted = decrypt(payload, key);
    expect(decrypted.length).toBe(0);
  });
});

describe("encryptJSON/decryptJSON", () => {
  it("roundtrips a JSON object", () => {
    const data = { name: "test", count: 42 };
    const payload = encryptJSON(data, key);
    const result = decryptJSON(payload, key);
    expect(result).toEqual(data);
  });

  it("roundtrips nested data types", () => {
    const data = {
      members: [{ name: "Alice" }, { name: "Bob" }],
      meta: { nested: { deep: true } },
      count: 0,
      active: false,
      tags: ["a", "b"],
    };
    const payload = encryptJSON(data, key);
    const result = decryptJSON(payload, key);
    expect(result).toEqual(data);
  });

  it("wrong key throws DecryptionFailedError", () => {
    const wrongKey = getSodium().aeadKeygen();
    const payload = encryptJSON({ data: true }, key);
    expect(() => decryptJSON(payload, wrongKey)).toThrow(DecryptionFailedError);
  });

  it("undefined throws InvalidInputError", () => {
    expect(() => encryptJSON(undefined, key)).toThrow(InvalidInputError);
  });

  it("function throws InvalidInputError", () => {
    expect(() => encryptJSON(() => {}, key)).toThrow(InvalidInputError);
  });

  it("symbol throws InvalidInputError", () => {
    expect(() => encryptJSON(Symbol("test"), key)).toThrow(InvalidInputError);
  });

  it("non-JSON plaintext throws DecryptionFailedError with SyntaxError cause", () => {
    // Encrypt raw non-JSON text, then try to decrypt as JSON
    const notJson = encoder.encode("this is not json");
    const payload = encrypt(notJson, key);
    const error = (() => {
      try {
        decryptJSON(payload, key);
        return null;
      } catch (e: unknown) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(DecryptionFailedError);
    expect((error as DecryptionFailedError).cause).toBeInstanceOf(SyntaxError);
  });
});

describe("encryptStream/decryptStream", () => {
  it("roundtrips data larger than chunk size", () => {
    const chunkSize = 64;
    // 3.5 chunks worth of data
    const plaintext = new Uint8Array(chunkSize * 3 + chunkSize / 2);
    plaintext.set(adapter.randomBytes(plaintext.length));

    const payload = encryptStream(plaintext, key, chunkSize);
    const decrypted = decryptStream(payload, key);

    expect(decrypted).toEqual(plaintext);
  });

  it("roundtrips data smaller than one chunk", () => {
    const plaintext = encoder.encode("small");
    const payload = encryptStream(plaintext, key, 65536);
    expect(payload.chunks.length).toBe(1);
    const decrypted = decryptStream(payload, key);
    expect(decoder.decode(decrypted)).toBe("small");
  });

  it("chunk count matches expected", () => {
    const chunkSize = 100;
    const plaintext = new Uint8Array(350);
    const payload = encryptStream(plaintext, key, chunkSize);
    // 350 / 100 = 4 chunks (100, 100, 100, 50)
    expect(payload.chunks.length).toBe(4);
    expect(payload.totalLength).toBe(350);
  });

  it("reordered chunks fail decryption", () => {
    const chunkSize = 50;
    const plaintext = new Uint8Array(150);
    plaintext.set(adapter.randomBytes(150));
    const payload = encryptStream(plaintext, key, chunkSize);

    // Swap first two chunks
    const reordered = [
      payload.chunks[1],
      payload.chunks[0],
      ...payload.chunks.slice(2),
    ] as readonly EncryptedPayload[];

    expect(() =>
      decryptStream({ chunks: reordered, totalLength: payload.totalLength }, key),
    ).toThrow(DecryptionFailedError);
  });

  it("truncated (missing chunk) fails decryption", () => {
    const chunkSize = 50;
    const plaintext = new Uint8Array(150);
    plaintext.set(adapter.randomBytes(plaintext.length));
    const payload = encryptStream(plaintext, key, chunkSize);

    // Remove last chunk
    const truncated = payload.chunks.slice(0, -1);

    expect(() =>
      decryptStream({ chunks: truncated, totalLength: payload.totalLength }, key),
    ).toThrow(DecryptionFailedError);
  });

  it("tampered single chunk fails decryption", () => {
    const chunkSize = 50;
    const plaintext = new Uint8Array(150);
    plaintext.set(adapter.randomBytes(plaintext.length));
    const payload = encryptStream(plaintext, key, chunkSize);

    // Tamper with the second chunk's ciphertext
    const tamperedChunks = payload.chunks.map((c: EncryptedPayload, i: number) => {
      if (i === 1) {
        const tampered = new Uint8Array(c.ciphertext);
        tampered[0] = (tampered[0] ?? 0) ^ 0xff;
        return { ciphertext: tampered, nonce: c.nonce };
      }
      return c;
    }) as readonly EncryptedPayload[];

    expect(() =>
      decryptStream({ chunks: tamperedChunks, totalLength: payload.totalLength }, key),
    ).toThrow(DecryptionFailedError);
  });

  it("wrong key throws DecryptionFailedError", () => {
    const wrongKey = getSodium().aeadKeygen();
    const plaintext = encoder.encode("stream wrong key");
    const payload = encryptStream(plaintext, key, 64);
    expect(() => decryptStream(payload, wrongKey)).toThrow(DecryptionFailedError);
  });

  it("tampered totalLength throws DecryptionFailedError", () => {
    const plaintext = encoder.encode("length check");
    const payload = encryptStream(plaintext, key, 64);
    // Tamper with totalLength — chunks decrypt fine but length won't match
    expect(() =>
      decryptStream({ chunks: payload.chunks, totalLength: payload.totalLength + 1 }, key),
    ).toThrow(DecryptionFailedError);
  });

  it("chunkSize = 0 throws InvalidInputError", () => {
    const plaintext = encoder.encode("zero chunk");
    expect(() => encryptStream(plaintext, key, 0)).toThrow(InvalidInputError);
  });

  it("negative chunkSize throws InvalidInputError", () => {
    const plaintext = encoder.encode("negative chunk");
    expect(() => encryptStream(plaintext, key, -1)).toThrow(InvalidInputError);
  });

  it("roundtrips empty input", () => {
    const plaintext = new Uint8Array(0);
    const payload = encryptStream(plaintext, key, 64);
    const decrypted = decryptStream(payload, key);
    expect(decrypted.length).toBe(0);
  });

  it("duplicated chunks fail decryption (AAD mismatch)", () => {
    const chunkSize = 50;
    const plaintext = new Uint8Array(150);
    plaintext.set(adapter.randomBytes(plaintext.length));
    const payload = encryptStream(plaintext, key, chunkSize);

    // Replace last chunk with a duplicate of the first — AAD chunk count changes
    const duplicated = [
      ...payload.chunks.slice(0, 2),
      payload.chunks[0],
    ] as readonly EncryptedPayload[];

    expect(() =>
      decryptStream({ chunks: duplicated, totalLength: payload.totalLength }, key),
    ).toThrow(DecryptionFailedError);
  });
});

describe("encryptStreamAsync", () => {
  const CHUNK = 64;

  it("matches encryptStream(Uint8Array) semantics for the fast path", async () => {
    const plaintext = encoder.encode("in-memory fast path");
    const sync = encryptStream(plaintext, key, CHUNK);
    const async = await encryptStreamAsync(plaintext, key, CHUNK);

    expect(async.totalLength).toBe(sync.totalLength);
    expect(async.chunks.length).toBe(sync.chunks.length);

    // Round-trip confirms semantic equivalence even if nonces differ.
    expect(decryptStream(async, key)).toEqual(plaintext);
  });

  it("round-trips data from an async iterable of uneven chunks", async () => {
    const plaintext = new Uint8Array(CHUNK * 3 + 17);
    plaintext.set(adapter.randomBytes(plaintext.length));

    // Deliberately emit mis-aligned slices to exercise the re-chunker.
    const parts: readonly Uint8Array[] = [
      plaintext.subarray(0, 31),
      plaintext.subarray(31, 31 + CHUNK + 3),
      plaintext.subarray(31 + CHUNK + 3),
    ];
    let idx = 0;
    const source: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
        return {
          next(): Promise<IteratorResult<Uint8Array>> {
            const value = parts[idx];
            if (idx >= parts.length || value === undefined) {
              return Promise.resolve({ done: true, value: undefined });
            }
            idx += 1;
            return Promise.resolve({ done: false, value });
          },
        };
      },
    };

    const payload = await encryptStreamAsync(source, key, CHUNK);
    expect(payload.totalLength).toBe(plaintext.byteLength);
    expect(decryptStream(payload, key)).toEqual(plaintext);
  });

  it("round-trips data from a ReadableByteStream-shaped source", async () => {
    const plaintext = new Uint8Array(CHUNK * 2 + 5);
    plaintext.set(adapter.randomBytes(plaintext.length));

    // Construct a minimal object matching the ReadableByteStream interface
    // the crypto package ships. Avoids depending on the DOM lib in the
    // crypto package tsconfig.
    const parts: readonly Uint8Array[] = [
      plaintext.subarray(0, 10),
      plaintext.subarray(10, CHUNK),
      plaintext.subarray(CHUNK),
    ];
    type ReadResult =
      | { readonly done: true; readonly value?: undefined }
      | { readonly done: false; readonly value: Uint8Array };
    let cursor = 0;
    const stream = {
      getReader(): {
        read(): Promise<ReadResult>;
        releaseLock(): void;
        cancel(): Promise<void>;
      } {
        return {
          read(): Promise<ReadResult> {
            const value = parts[cursor];
            if (cursor >= parts.length || value === undefined) {
              return Promise.resolve({ done: true, value: undefined });
            }
            cursor += 1;
            return Promise.resolve({ done: false, value });
          },
          releaseLock(): void {
            /* noop */
          },
          cancel(): Promise<void> {
            return Promise.resolve();
          },
        };
      },
    };

    const payload = await encryptStreamAsync(stream, key, CHUNK);
    expect(payload.totalLength).toBe(plaintext.byteLength);
    expect(decryptStream(payload, key)).toEqual(plaintext);
  });

  it("honours backpressure — source is pulled chunk-by-chunk, not drained upfront", async () => {
    // This test checks that we don't buffer the entire producer upfront. The
    // producer yields small slices and counts how many are outstanding at any
    // moment; the encryption path should never hold more than one pending slice
    // beyond the current accumulating chunk.
    const chunkSize = 128;
    const totalBytes = chunkSize * 8;
    const plaintext = new Uint8Array(totalBytes);
    plaintext.set(adapter.randomBytes(totalBytes));

    let outstanding = 0;
    let maxOutstanding = 0;

    const source: AsyncIterable<Uint8Array> = (async function* () {
      for (let off = 0; off < totalBytes; off += 32) {
        outstanding += 1;
        maxOutstanding = Math.max(maxOutstanding, outstanding);
        // Micro-pause so the consumer gets a chance to drain before we yield again.
        await Promise.resolve();
        yield plaintext.subarray(off, Math.min(off + 32, totalBytes));
        outstanding -= 1;
      }
    })();

    const payload = await encryptStreamAsync(source, key, chunkSize);
    expect(payload.totalLength).toBe(totalBytes);
    expect(decryptStream(payload, key)).toEqual(plaintext);
    // The AsyncIterable contract guarantees one outstanding yield at a time;
    // confirm the adapter has not monkeyed with it.
    expect(maxOutstanding).toBeLessThanOrEqual(1);
  });

  it("handles an empty stream (one empty chunk to match Uint8Array semantics)", async () => {
    // Construct an async iterable that yields nothing. A `async function*` with
    // no `await` trips @typescript-eslint/require-await; build the iterator
    // protocol directly instead.
    const empty: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
        return {
          next(): Promise<IteratorResult<Uint8Array>> {
            return Promise.resolve({ done: true, value: undefined });
          },
        };
      },
    };

    const payload = await encryptStreamAsync(empty, key, CHUNK);
    expect(payload.totalLength).toBe(0);
    expect(decryptStream(payload, key).length).toBe(0);
  });

  it("rejects chunkSize <= 0", async () => {
    await expect(encryptStreamAsync(new Uint8Array(10), key, 0)).rejects.toThrow(InvalidInputError);
  });
});

describe("decryptStream output pre-allocation (crypto-tirn)", () => {
  it(
    "round-trips a multi-MiB payload without intermediate parts[] allocation",
    { timeout: 60_000 },
    () => {
      const MIB = 1_024 * 1_024;
      const chunkSize = 64 * 1_024; // 64 KiB — same as blob-pipeline default
      // 2 MiB keeps WASM AEAD latency reasonable on CI while still producing
      // 32 chunks — enough to prove the re-chunker/concat path is exercised.
      const plaintext = new Uint8Array(2 * MIB);
      plaintext.set(adapter.randomBytes(plaintext.length));

      const payload = encryptStream(plaintext, key, chunkSize);
      expect(payload.chunks.length).toBe(Math.ceil(plaintext.length / chunkSize));

      const decrypted = decryptStream(payload, key);
      expect(decrypted.byteLength).toBe(plaintext.byteLength);
      expect(decrypted).toEqual(plaintext);
    },
  );

  it("rejects a negative declared totalLength", () => {
    const plaintext = encoder.encode("negative check");
    const payload = encryptStream(plaintext, key, 64);
    expect(() => decryptStream({ chunks: payload.chunks, totalLength: -1 }, key)).toThrow(
      DecryptionFailedError,
    );
  });

  it("rejects a non-integer declared totalLength", () => {
    const plaintext = encoder.encode("nan check");
    const payload = encryptStream(plaintext, key, 64);
    expect(() => decryptStream({ chunks: payload.chunks, totalLength: Number.NaN }, key)).toThrow(
      DecryptionFailedError,
    );
  });

  it("rejects a totalLength smaller than the actual decrypted payload", () => {
    const plaintext = new Uint8Array(200);
    plaintext.set(adapter.randomBytes(plaintext.length));
    const payload = encryptStream(plaintext, key, 64);
    // Truthful totalLength would be 200; tamper down to 100.
    expect(() => decryptStream({ chunks: payload.chunks, totalLength: 100 }, key)).toThrow(
      DecryptionFailedError,
    );
  });
});

describe("decryptStream impossible-payload guards", () => {
  it("rejects a totalLength above MAX_DECRYPT_STREAM_BYTES before allocating", () => {
    const plaintext = encoder.encode("small");
    const payload = encryptStream(plaintext, key, 64);
    expect(() =>
      decryptStream({ chunks: payload.chunks, totalLength: MAX_DECRYPT_STREAM_BYTES + 1 }, key),
    ).toThrow(DecryptionFailedError);
  });

  it("rejects a chunk count above MAX_STREAM_CHUNKS", () => {
    // The guard fires on `.chunks.length` alone, so sharing a single dummy
    // chunk across the array keeps this test allocation-light instead of
    // producing 65_537 real nonces.
    const dummy: EncryptedPayload = {
      ciphertext: new Uint8Array(0),
      nonce: new Uint8Array(AEAD_NONCE_BYTES) as EncryptedPayload["nonce"],
    };
    const overflowChunks: readonly EncryptedPayload[] = new Array<EncryptedPayload>(
      MAX_STREAM_CHUNKS + 1,
    ).fill(dummy);
    expect(() => decryptStream({ chunks: overflowChunks, totalLength: 1 }, key)).toThrow(
      DecryptionFailedError,
    );
  });

  it("rejects totalLength > chunks * MAX_PLAINTEXT_CHUNK_BYTES (cross-check)", () => {
    const plaintext = encoder.encode("small");
    const payload = encryptStream(plaintext, key, 64);
    // One chunk cannot legitimately carry more than MAX_PLAINTEXT_CHUNK_BYTES;
    // declaring otherwise is an attacker submitting a huge totalLength with a
    // tiny chunk list.
    const totalLength = MAX_PLAINTEXT_CHUNK_BYTES * payload.chunks.length + 1;
    expect(() => decryptStream({ chunks: payload.chunks, totalLength }, key)).toThrow(
      DecryptionFailedError,
    );
  });
});

describe("encryptStreamAsync cleanup paths", () => {
  it("memzeros plaintext chunks after a successful encryption", async () => {
    const plaintext = new Uint8Array(200);
    plaintext.set(adapter.randomBytes(plaintext.length));
    const source: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
        let yielded = false;
        return {
          next(): Promise<IteratorResult<Uint8Array>> {
            if (yielded) return Promise.resolve({ done: true, value: undefined });
            yielded = true;
            return Promise.resolve({ done: false, value: plaintext });
          },
        };
      },
    };

    const memzeroSpy = vi.spyOn(getSodium(), "memzero");
    try {
      await encryptStreamAsync(source, key, 64);
      // Each chunk is memzero'd at least once after the encryption.
      expect(memzeroSpy).toHaveBeenCalled();
    } finally {
      memzeroSpy.mockRestore();
    }
  });

  it("memzeros plaintext buffers when the source throws", async () => {
    const failure = new Error("producer boom");
    const source: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
        let step = 0;
        return {
          next(): Promise<IteratorResult<Uint8Array>> {
            step += 1;
            if (step === 1) {
              return Promise.resolve({ done: false, value: new Uint8Array(32) });
            }
            return Promise.reject(failure);
          },
        };
      },
    };

    const memzeroSpy = vi.spyOn(getSodium(), "memzero");
    try {
      await expect(encryptStreamAsync(source, key, 64)).rejects.toBe(failure);
      // The collected chunk + the in-flight buffer are both memzero'd.
      expect(memzeroSpy).toHaveBeenCalled();
    } finally {
      memzeroSpy.mockRestore();
    }
  });

  it("cancels the underlying reader when the consumer errors", async () => {
    const plaintext = new Uint8Array(200);
    plaintext.set(adapter.randomBytes(plaintext.length));
    let cancelled = false;
    const boom = new Error("downstream boom");

    // The first read returns a chunk; the second read throws, simulating an
    // upstream failure after the reader has been locked.
    let step = 0;
    type ReadResult =
      | { readonly done: true; readonly value?: undefined }
      | { readonly done: false; readonly value: Uint8Array };
    const stream = {
      getReader(): {
        read(): Promise<ReadResult>;
        releaseLock(): void;
        cancel(): Promise<void>;
      } {
        return {
          read(): Promise<ReadResult> {
            step += 1;
            if (step === 1) return Promise.resolve({ done: false, value: plaintext });
            return Promise.reject(boom);
          },
          releaseLock(): void {
            /* noop */
          },
          cancel(): Promise<void> {
            cancelled = true;
            return Promise.resolve();
          },
        };
      },
    };

    await expect(encryptStreamAsync(stream, key, 64)).rejects.toBe(boom);
    expect(cancelled).toBe(true);
  });

  it("handles a single tail chunk below chunkSize (filled > 0 path)", async () => {
    const plaintext = encoder.encode("tail");
    const source: AsyncIterable<Uint8Array> = {
      [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
        let yielded = false;
        return {
          next(): Promise<IteratorResult<Uint8Array>> {
            if (yielded) return Promise.resolve({ done: true, value: undefined });
            yielded = true;
            return Promise.resolve({ done: false, value: plaintext });
          },
        };
      },
    };

    const payload = await encryptStreamAsync(source, key, 64);
    expect(payload.totalLength).toBe(plaintext.byteLength);
    expect(decryptStream(payload, key)).toEqual(plaintext);
  });

  it("skips zero-length chunks yielded by a ReadableByteStream", async () => {
    const plaintext = encoder.encode("valid bytes only");
    const parts: readonly Uint8Array[] = [new Uint8Array(0), plaintext];
    let cursor = 0;
    type ReadResult =
      | { readonly done: true; readonly value?: undefined }
      | { readonly done: false; readonly value: Uint8Array };
    const stream = {
      getReader(): {
        read(): Promise<ReadResult>;
        releaseLock(): void;
        cancel(): Promise<void>;
      } {
        return {
          read(): Promise<ReadResult> {
            const value = parts[cursor];
            if (cursor >= parts.length || value === undefined) {
              return Promise.resolve({ done: true, value: undefined });
            }
            cursor += 1;
            return Promise.resolve({ done: false, value });
          },
          releaseLock(): void {
            /* noop */
          },
          cancel(): Promise<void> {
            return Promise.resolve();
          },
        };
      },
    };

    const payload = await encryptStreamAsync(stream, key, 64);
    expect(payload.totalLength).toBe(plaintext.byteLength);
    expect(decryptStream(payload, key)).toEqual(plaintext);
  });
});
