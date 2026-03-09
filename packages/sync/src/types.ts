import type {
  AeadKey,
  AeadNonce,
  Signature,
  SignKeypair,
  SignPublicKey,
  SignSecretKey,
} from "@pluralscape/crypto";

export interface DocumentKeys {
  readonly encryptionKey: AeadKey;
  readonly signingKeys: {
    readonly publicKey: SignPublicKey;
    readonly secretKey: SignSecretKey;
  };
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

export interface MemberProfile {
  name: string;
  pronouns: string;
  description: string;
}

export type { AeadKey, AeadNonce, Signature, SignKeypair, SignPublicKey, SignSecretKey };
