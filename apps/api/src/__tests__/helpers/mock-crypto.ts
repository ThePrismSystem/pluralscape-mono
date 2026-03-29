import { vi } from "vitest";

/** Factory for the standard @pluralscape/crypto mock used across service tests. */
export function createCryptoMock(): Record<string, unknown> {
  return {
    AEAD_KEY_BYTES: 32,
    serializeEncryptedBlob: vi.fn(() => new Uint8Array([1, 2, 3])),
    deserializeEncryptedBlob: vi.fn((data: Uint8Array) => ({
      tier: 1,
      algorithm: "xchacha20-poly1305",
      keyVersion: null,
      bucketId: null,
      nonce: new Uint8Array(24),
      ciphertext: new Uint8Array(data.slice(32)),
    })),
    InvalidInputError: class InvalidInputError extends Error {
      override readonly name = "InvalidInputError" as const;
    },
  };
}

/** Base64-encoded 40-byte blob that passes encrypted-data validation. */
export const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");
