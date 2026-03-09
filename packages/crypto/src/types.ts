// ── Branded type infrastructure ──────────────────────────────────────
declare const __cryptoBrand: unique symbol;
type CryptoBrand<B extends string> = Uint8Array & { readonly [__cryptoBrand]: B };

// ── Branded key/nonce/signature types ────────────────────────────────
export type AeadKey = CryptoBrand<"AeadKey">;
export type AeadNonce = CryptoBrand<"AeadNonce">;
export type BoxPublicKey = CryptoBrand<"BoxPublicKey">;
export type BoxSecretKey = CryptoBrand<"BoxSecretKey">;
export type BoxNonce = CryptoBrand<"BoxNonce">;
export type SignPublicKey = CryptoBrand<"SignPublicKey">;
export type SignSecretKey = CryptoBrand<"SignSecretKey">;
export type Signature = CryptoBrand<"Signature">;
export type KdfMasterKey = CryptoBrand<"KdfMasterKey">;
export type PwhashSalt = CryptoBrand<"PwhashSalt">;

// ── Keypair types ────────────────────────────────────────────────────
export interface BoxKeypair {
  readonly publicKey: BoxPublicKey;
  readonly secretKey: BoxSecretKey;
}

export interface SignKeypair {
  readonly publicKey: SignPublicKey;
  readonly secretKey: SignSecretKey;
}

/** An asymmetric keypair (X25519 or Ed25519). Generic alias for backward compat. */
export type CryptoKeypair = BoxKeypair | SignKeypair;

/** Result of an AEAD encryption operation. */
export interface AeadResult {
  /** Ciphertext with appended authentication tag. */
  readonly ciphertext: Uint8Array;
  /** Nonce used for this encryption (24 bytes for XChaCha20). */
  readonly nonce: AeadNonce;
}
