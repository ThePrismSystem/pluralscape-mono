import type { AeadKey, SignKeypair, SignPublicKey } from "@pluralscape/crypto";
import type { AeadNonce, Signature } from "@pluralscape/crypto";

export interface DocumentKeys {
  readonly encryptionKey: AeadKey;
  readonly signingKeys: SignKeypair;
}

export interface EncryptedChangeEnvelope {
  readonly ciphertext: Uint8Array;
  readonly nonce: AeadNonce;
  readonly signature: Signature;
  readonly authorPublicKey: SignPublicKey;
  readonly documentId: string;
  readonly seq: number;
}

export interface EncryptedSnapshotEnvelope {
  readonly ciphertext: Uint8Array;
  readonly nonce: AeadNonce;
  readonly signature: Signature;
  readonly authorPublicKey: SignPublicKey;
  readonly documentId: string;
  readonly snapshotVersion: number;
}
