/**
 * Deterministic key generation helpers for reproducible encryption tests.
 *
 * These helpers generate key material from fixed seeds so that tests
 * produce consistent, predictable outputs. DO NOT use in production.
 */

const ENCODER = new TextEncoder();

/**
 * Derives a deterministic 32-byte key from a seed string using SHA-256.
 * Useful for creating reproducible symmetric keys in tests.
 */
export async function deterministicKey(seed: string): Promise<Uint8Array> {
  const data = ENCODER.encode(seed);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}

/**
 * Generates a deterministic keypair seed from a label.
 * Returns a 32-byte seed suitable for libsodium keypair generation.
 */
export async function deterministicKeypairSeed(label: string): Promise<Uint8Array> {
  return deterministicKey(`keypair:${label}`);
}

/**
 * Generates a deterministic nonce (24 bytes) from a seed string.
 * Suitable for XChaCha20-Poly1305 nonces in tests.
 */
export async function deterministicNonce(seed: string): Promise<Uint8Array> {
  const key = await deterministicKey(`nonce:${seed}`);
  const NONCE_BYTES = 24;
  return key.slice(0, NONCE_BYTES);
}
