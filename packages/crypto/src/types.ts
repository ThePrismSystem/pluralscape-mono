/** Result of an AEAD encryption operation. */
export interface AeadResult {
  /** Ciphertext with appended authentication tag. */
  readonly ciphertext: Uint8Array;
  /** Nonce used for this encryption (24 bytes for XChaCha20). */
  readonly nonce: Uint8Array;
}

/** An asymmetric keypair (X25519 or Ed25519). */
export interface CryptoKeypair {
  readonly publicKey: Uint8Array;
  readonly secretKey: Uint8Array;
}
