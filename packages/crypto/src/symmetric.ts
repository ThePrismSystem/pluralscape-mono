import { DecryptionFailedError, InvalidInputError } from "./errors.js";
import { getSodium } from "./sodium.js";

import type { AeadKey, AeadNonce } from "./types.js";

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
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
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
 * Encrypt plaintext in chunks. Each chunk gets independent AEAD encryption
 * with chunk index in AAD to prevent reordering/truncation.
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
 * Decrypt a stream-encrypted payload. Verifies chunk count against AAD
 * to detect truncation and reordering attacks.
 */
export function decryptStream(payload: StreamEncryptedPayload, key: AeadKey): Uint8Array {
  const totalChunks = payload.chunks.length;
  const parts: Uint8Array[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunk = payload.chunks[i];
    if (!chunk) {
      throw new DecryptionFailedError("Missing chunk in stream payload.");
    }
    const aad = buildChunkAad(i, totalChunks);
    try {
      parts.push(decrypt(chunk, key, aad));
    } catch (error: unknown) {
      throw new DecryptionFailedError("Stream decryption failed at chunk " + String(i) + ".", {
        cause: error,
      });
    }
  }

  // Concatenate all decrypted parts
  const totalBytes = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  if (result.length !== payload.totalLength) {
    throw new DecryptionFailedError(
      "Decrypted stream length mismatch: expected " +
        String(payload.totalLength) +
        " bytes, got " +
        String(result.length) +
        ".",
    );
  }

  return result;
}
