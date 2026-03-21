import type { EncryptedSnapshotEnvelope } from "../types.js";
import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";
import type { SyncDocumentId, SystemId } from "@pluralscape/types";

// Cast test values to branded types — these are contract test fixtures,
// not real cryptographic material.
export function asSyncDocId(id: string): SyncDocumentId {
  return id as SyncDocumentId;
}
export function sysId(id: string): SystemId {
  return id as SystemId;
}

export function nonce(fill: number): AeadNonce {
  const bytes: unknown = new Uint8Array(24).fill(fill);
  return bytes as AeadNonce;
}
export function pubkey(fill: number): SignPublicKey {
  const bytes: unknown = new Uint8Array(32).fill(fill);
  return bytes as SignPublicKey;
}
export function sig(fill: number): Signature {
  const bytes: unknown = new Uint8Array(64).fill(fill);
  return bytes as Signature;
}

export function makeSnapshot(
  version: number,
  documentId: SyncDocumentId,
): EncryptedSnapshotEnvelope {
  return {
    documentId,
    snapshotVersion: version,
    ciphertext: new Uint8Array([10, 20, 30, version]),
    nonce: nonce(version),
    signature: sig(3),
    authorPublicKey: pubkey(1),
  };
}
