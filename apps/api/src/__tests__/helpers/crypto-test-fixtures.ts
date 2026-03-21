/**
 * Shared crypto test fixtures for API test files.
 *
 * These produce branded byte arrays for use in tests that need
 * cryptographic-looking data without real cryptographic material.
 */
import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "@pluralscape/sync";

/** Create a test AeadNonce (24 bytes) filled with the given value. */
export function nonce(fill: number): AeadNonce {
  const bytes: unknown = new Uint8Array(24).fill(fill);
  return bytes as AeadNonce;
}

/** Create a test SignPublicKey (32 bytes) filled with the given value. */
export function pubkey(fill: number): SignPublicKey {
  const bytes: unknown = new Uint8Array(32).fill(fill);
  return bytes as SignPublicKey;
}

/** Create a test Signature (64 bytes) filled with the given value. */
export function sig(fill: number): Signature {
  const bytes: unknown = new Uint8Array(64).fill(fill);
  return bytes as Signature;
}

/** Build a minimal change envelope (without seq). */
export function makeEnvelope(documentId: string): Omit<EncryptedChangeEnvelope, "seq"> {
  return {
    documentId,
    ciphertext: new Uint8Array([0xde, 0xad]),
    authorPublicKey: pubkey(0x01),
    nonce: nonce(0x02),
    signature: sig(0x77),
  };
}

/** Build a minimal snapshot envelope. */
export function makeSnapshotEnvelope(
  documentId: string,
  snapshotVersion = 1,
): EncryptedSnapshotEnvelope {
  return {
    documentId,
    snapshotVersion,
    ciphertext: new Uint8Array([0xca, 0xfe]),
    authorPublicKey: pubkey(0x03),
    nonce: nonce(0x04),
    signature: sig(0x88),
  };
}
