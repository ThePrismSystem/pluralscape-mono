import { GENERIC_HASH_BYTES_MAX, getSodium } from "@pluralscape/crypto";

import { toHex } from "./hex.js";

/** Number of random bytes for a session token (32 bytes = 64 hex chars). */
const SESSION_TOKEN_BYTES = 32;

/** Generate a cryptographically random session token (hex-encoded). */
export function generateSessionToken(): string {
  const adapter = getSodium();
  return toHex(adapter.randomBytes(SESSION_TOKEN_BYTES));
}

/** Hash a session token using BLAKE2b for storage. */
export function hashSessionToken(token: string): string {
  const adapter = getSodium();
  return toHex(adapter.genericHash(GENERIC_HASH_BYTES_MAX, new TextEncoder().encode(token)));
}
