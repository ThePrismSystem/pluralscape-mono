import type { CryptoBrand, KdfMasterKey } from "@pluralscape/types/crypto-keys";

// ── Branded type infrastructure ──────────────────────────────────────
declare const __numericBrand: unique symbol;
type NumericBrand<B extends string> = number & { readonly [__numericBrand]: B };

// ── Branded numeric types ───────────────────────────────────────────
export type KeyVersion = NumericBrand<"KeyVersion">;

// ── Branded key/nonce/signature types ────────────────────────────────
export type AeadKey = CryptoBrand<"AeadKey">;
export type AeadNonce = CryptoBrand<"AeadNonce">;
export type BoxPublicKey = CryptoBrand<"BoxPublicKey">;
export type BoxSecretKey = CryptoBrand<"BoxSecretKey">;
export type BoxNonce = CryptoBrand<"BoxNonce">;
export type SignPublicKey = CryptoBrand<"SignPublicKey">;
export type SignSecretKey = CryptoBrand<"SignSecretKey">;
export type Signature = CryptoBrand<"Signature">;
export type { KdfMasterKey };
export type PwhashSalt = CryptoBrand<"PwhashSalt">;
export type EncryptedKeyGrant = CryptoBrand<"EncryptedKeyGrant">;
/**
 * Nominal brand for a 32-byte auth-key buffer (the client-side-derived proof
 * of password knowledge). Named `AuthKeyMaterial` rather than `AuthKey` to
 * avoid colliding with the domain `EncryptedBlob` namespace in types —
 * everything here is key *material*, not a key abstraction.
 */
export type AuthKeyMaterial = CryptoBrand<"AuthKeyMaterial">;
export type AuthKeyHash = CryptoBrand<"AuthKeyHash">;
export type RecoveryKeyHash = CryptoBrand<"RecoveryKeyHash">;
export type ChallengeNonce = CryptoBrand<"ChallengeNonce">;

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
