/**
 * Shared utilities for SQLite-backed sync adapters.
 */

import { assertAeadNonce, assertSignPublicKey, assertSignature } from "@pluralscape/crypto";

import type { AeadNonce, SignPublicKey, Signature } from "@pluralscape/crypto";

/**
 * Ensure a BLOB value is a plain Uint8Array (not a Buffer subclass).
 *
 * SQLite drivers (including Bun's `bun:sqlite`) may return Buffer
 * (a Uint8Array subclass) for BLOB columns. This normalises to plain
 * Uint8Array so branded type assertions work correctly downstream.
 */
export function toUint8Array(buf: Uint8Array): Uint8Array {
  return buf.constructor === Uint8Array ? buf : new Uint8Array(buf);
}

interface BlobRow {
  nonce: Uint8Array;
  signature: Uint8Array;
  author_public_key: Uint8Array;
}

export interface AssertedEnvelopeBlobs {
  nonce: AeadNonce;
  signature: Signature;
  authorPublicKey: SignPublicKey;
}

/**
 * Normalise and validate the three crypto BLOB fields common to all envelope rows.
 *
 * Converts Buffer subclasses to plain Uint8Array, then asserts correct byte
 * lengths for nonce, signature, and author public key. Throws InvalidInputError
 * if any field has the wrong length.
 */
export function assertEnvelopeBlobs(row: BlobRow): AssertedEnvelopeBlobs {
  const nonce = toUint8Array(row.nonce);
  assertAeadNonce(nonce);
  const signature = toUint8Array(row.signature);
  assertSignature(signature);
  const authorPublicKey = toUint8Array(row.author_public_key);
  assertSignPublicKey(authorPublicKey);
  return { nonce, signature, authorPublicKey };
}
