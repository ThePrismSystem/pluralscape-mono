import { InvalidInputError } from "./errors.js";
import { getSodium } from "./sodium.js";
import { decrypt, encrypt } from "./symmetric.js";
import { assertKdfMasterKey } from "./validation.js";

import type { EncryptedPayload } from "./symmetric.js";
import type { AeadKey, KdfMasterKey } from "./types.js";

/** Result of generating a recovery key. */
export interface RecoveryKeyResult {
  /** Human-readable recovery key (13 groups of 4 base32 chars, e.g. ABCD-EFGH-...). */
  readonly displayKey: string;
  /** The master key encrypted under the recovery key bytes. */
  readonly encryptedMasterKey: EncryptedPayload;
}

// ── Base32 (RFC 4648, A-Z + 2-7, no padding) ──────────────────────

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Number of bits in a single byte. */
const BITS_PER_BYTE = 8;

/** Number of bits encoded by each base32 character. */
const BITS_PER_B32_CHAR = 5;

/** Bitmask for the low 5 bits (used to extract a base32 index). */
const B32_CHAR_MASK = 0x1f;

/** Bitmask for the low 8 bits (used to extract a decoded byte). */
const BYTE_MASK = 0xff;

/** Number of random bytes in a recovery key (256-bit). */
const RECOVERY_KEY_BYTES = 32;

/** Number of base32 characters per display group. */
const RECOVERY_KEY_GROUP_SIZE = 4;

/** Encode bytes to unpadded base32 (RFC 4648). */
function encodeBase32(bytes: Uint8Array): string {
  let result = "";
  let buffer = 0;
  let bitsLeft = 0;

  for (const byte of bytes) {
    buffer = (buffer << BITS_PER_BYTE) | byte;
    bitsLeft += BITS_PER_BYTE;
    while (bitsLeft >= BITS_PER_B32_CHAR) {
      bitsLeft -= BITS_PER_B32_CHAR;
      result += BASE32_ALPHABET[(buffer >> bitsLeft) & B32_CHAR_MASK] ?? "";
    }
  }

  if (bitsLeft > 0) {
    result += BASE32_ALPHABET[(buffer << (BITS_PER_B32_CHAR - bitsLeft)) & B32_CHAR_MASK] ?? "";
  }

  return result;
}

/** Decode unpadded base32 to bytes. Throws InvalidInputError on invalid chars. */
function decodeBase32(str: string): Uint8Array {
  const bytes: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;

  for (const char of str) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val < 0) {
      throw new InvalidInputError(`Invalid base32 character: '${char}'`);
    }
    buffer = (buffer << BITS_PER_B32_CHAR) | val;
    bitsLeft += BITS_PER_B32_CHAR;
    if (bitsLeft >= BITS_PER_BYTE) {
      bitsLeft -= BITS_PER_BYTE;
      bytes.push((buffer >> bitsLeft) & BYTE_MASK);
    }
  }

  return new Uint8Array(bytes);
}

// ── Format validation ──────────────────────────────────────────────

/** Pattern: 13 groups of 4 base32 chars (A-Z, 2-7) separated by dashes. */
const RECOVERY_KEY_PATTERN = /^([A-Z2-7]{4}-){12}[A-Z2-7]{4}$/;

/** Check whether a recovery key string has the correct display format. */
export function isValidRecoveryKeyFormat(displayKey: string): boolean {
  return RECOVERY_KEY_PATTERN.test(displayKey);
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Generate a recovery key and encrypt the master key under it.
 *
 * The recovery key is 256 bits of randomness encoded as 52 base32 characters
 * (13 groups of 4, separated by dashes). The recovery key bytes are used
 * directly as an AEAD key to encrypt the master key. The recovery key bytes
 * are zeroed from memory after use — the caller must store `displayKey` safely.
 */
export function generateRecoveryKey(masterKey: KdfMasterKey): RecoveryKeyResult {
  const adapter = getSodium();
  const recoveryKeyBytes = adapter.randomBytes(RECOVERY_KEY_BYTES);
  try {
    const encoded = encodeBase32(recoveryKeyBytes);
    const groups: string[] = [];
    for (let i = 0; i < encoded.length; i += RECOVERY_KEY_GROUP_SIZE) {
      groups.push(encoded.slice(i, i + RECOVERY_KEY_GROUP_SIZE));
    }
    const displayKey = groups.join("-");
    const encryptedMasterKey = encrypt(masterKey, recoveryKeyBytes as AeadKey);
    return { displayKey, encryptedMasterKey };
  } finally {
    adapter.memzero(recoveryKeyBytes);
  }
}

/**
 * Recover the master key from a display recovery key and the encrypted blob.
 *
 * Validates display key format, decodes base32, decrypts the master key,
 * and zeros the recovery key bytes from memory. Throws InvalidInputError on
 * bad format, DecryptionFailedError on wrong key or tampered blob.
 */
export function recoverMasterKey(
  displayKey: string,
  encryptedMasterKey: EncryptedPayload,
): KdfMasterKey {
  if (!isValidRecoveryKeyFormat(displayKey)) {
    throw new InvalidInputError(
      "Invalid recovery key format. Expected 13 groups of 4 base32 characters (A-Z, 2-7) separated by dashes.",
    );
  }
  const normalized = displayKey.replace(/-/g, "");
  const recoveryKeyBytes = decodeBase32(normalized);
  const adapter = getSodium();
  try {
    const raw = decrypt(encryptedMasterKey, recoveryKeyBytes as AeadKey);
    assertKdfMasterKey(raw);
    return raw as KdfMasterKey;
  } finally {
    adapter.memzero(recoveryKeyBytes);
  }
}
