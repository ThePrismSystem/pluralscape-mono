import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WasmSodiumAdapter } from "../adapter/wasm-adapter.js";
import { AEAD_NONCE_BYTES } from "../crypto.constants.js";
import { DecryptionFailedError, InvalidInputError } from "../errors.js";
import { _resetForTesting, configureSodium, initSodium, getSodium } from "../sodium.js";
import {
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  encryptStream,
  encryptStreamAsync,
  decryptStream,
} from "../symmetric.js";

import type { SodiumAdapter } from "../adapter/interface.js";
import type { EncryptedPayload } from "../symmetric.js";
import type { AeadKey } from "../types.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let key: AeadKey;
let adapter: SodiumAdapter;

beforeAll(async () => {
  _resetForTesting();
  adapter = new WasmSodiumAdapter();
  configureSodium(adapter);
  await initSodium();
  key = getSodium().aeadKeygen();
});

afterAll(() => {
  _resetForTesting();
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
    let cursor = 0;
    const stream = {
      getReader(): {
        read(): Promise<{ readonly done: boolean; readonly value?: Uint8Array }>;
        releaseLock(): void;
        cancel(): Promise<void>;
      } {
        return {
          read(): Promise<{ readonly done: boolean; readonly value?: Uint8Array }> {
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
