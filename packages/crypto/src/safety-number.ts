import {
  SAFETY_NUMBER_HASH_BYTES,
  SAFETY_NUMBER_ITERATIONS,
  SAFETY_NUMBER_VERSION,
} from "./constants.js";
import { getSodium } from "./sodium.js";

import type { SignPublicKey } from "./types.js";

/** The result of a Safety Number computation. */
export interface SafetyNumber {
  /** 12 groups of 5 digits separated by spaces, e.g. "12345 67890 ..." */
  readonly displayString: string;
  /** 60 raw bytes: 30 bytes per user fingerprint, ordered by key comparison. */
  readonly fingerprint: Uint8Array;
}

/**
 * Bytes in a 5-digit group for digit encoding.
 * 5 bytes → big-endian number → mod 100_000 → zero-padded to 5 digits.
 */
const BYTES_PER_GROUP = 5;

/** Number of 5-byte groups in a fingerprint (30 bytes / 5 bytes = 6 groups). */
const GROUPS_PER_FINGERPRINT = SAFETY_NUMBER_HASH_BYTES / BYTES_PER_GROUP;

/** Modulus for converting 5 bytes into a 5-digit decimal number (0-99999). */
const DIGIT_MODULUS = 100_000;

/** Number of decimal digits per group in the display string. */
const DIGITS_PER_GROUP = BYTES_PER_GROUP; // coincidentally the same

/** Multiplier to shift the high 4-byte value up by one byte. */
const BYTE_SHIFT = 256;

/**
 * Compute the per-user fingerprint (Signal-inspired, BLAKE2b).
 *
 * Input: version (2B uint16 LE) || publicKey (32B) || stableId (UTF-8)
 * Iterates BLAKE2b-30 for SAFETY_NUMBER_ITERATIONS rounds.
 */
function computeFingerprint(publicKey: SignPublicKey, stableId: string): Uint8Array {
  const adapter = getSodium();
  const encoder = new TextEncoder();
  const stableIdBytes = encoder.encode(stableId);

  // Build initial input: version (2 bytes LE) || publicKey || stableId
  const input = new Uint8Array(2 + publicKey.length + stableIdBytes.length);
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  view.setUint16(0, SAFETY_NUMBER_VERSION, true);
  input.set(publicKey, 2);
  input.set(stableIdBytes, 2 + publicKey.length);

  // Iterative hash: hash = BLAKE2b-30(hash || input) for N iterations
  // Type widened to Uint8Array (= Uint8Array<ArrayBufferLike>) to accommodate
  // the return type of genericHash across wasm/RN adapters.
  let hash: Uint8Array = input;
  for (let i = 0; i < SAFETY_NUMBER_ITERATIONS; i++) {
    const combined = new Uint8Array(hash.length + input.length);
    combined.set(hash, 0);
    combined.set(input, hash.length);
    hash = adapter.genericHash(SAFETY_NUMBER_HASH_BYTES, combined);
  }

  return hash;
}

/**
 * Encode a 30-byte fingerprint into 6 groups of 5 digits.
 * Each group: 5 bytes read as big-endian number, mod 100_000, zero-padded.
 */
function formatFingerprintDigits(fingerprint: Uint8Array): string[] {
  const groups: string[] = [];
  const view = new DataView(fingerprint.buffer, fingerprint.byteOffset, fingerprint.byteLength);

  for (let i = 0; i < GROUPS_PER_FINGERPRINT; i++) {
    const offset = i * BYTES_PER_GROUP;
    // Read 5 bytes as a big-endian number. Max value = 2^40 - 1 < 2^53 (safe JS integer).
    const hi = view.getUint32(offset, false); // big-endian upper 4 bytes
    const lo = view.getUint8(offset + (BYTES_PER_GROUP - 1)); // 5th byte
    const value = (hi * BYTE_SHIFT + lo) % DIGIT_MODULUS;
    groups.push(value.toString().padStart(DIGITS_PER_GROUP, "0"));
  }

  return groups;
}

/**
 * Compare two public keys lexicographically. Returns negative if a < b,
 * positive if a > b, 0 if equal. Used to ensure order-independence.
 */
function compareKeys(a: SignPublicKey, b: SignPublicKey): number {
  for (let i = 0; i < a.length && i < b.length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.length - b.length;
}

/**
 * Compute a Safety Number for two participants.
 *
 * The number is order-independent: swapping local and remote produces
 * the same result. stableId binds the fingerprint to an account identity,
 * preventing key reuse attacks across accounts.
 *
 * Display format: 12 groups of 5 digits separated by spaces.
 */
export function computeSafetyNumber(
  localPublicKey: SignPublicKey,
  localStableId: string,
  remotePublicKey: SignPublicKey,
  remoteStableId: string,
): SafetyNumber {
  const localFp = computeFingerprint(localPublicKey, localStableId);
  const remoteFp = computeFingerprint(remotePublicKey, remoteStableId);

  // Order by key: smaller key's fingerprint comes first
  const [firstFp, secondFp] =
    compareKeys(localPublicKey, remotePublicKey) <= 0 ? [localFp, remoteFp] : [remoteFp, localFp];

  const fingerprint = new Uint8Array(SAFETY_NUMBER_HASH_BYTES * 2);
  fingerprint.set(firstFp, 0);
  fingerprint.set(secondFp, SAFETY_NUMBER_HASH_BYTES);

  const firstGroups = formatFingerprintDigits(firstFp);
  const secondGroups = formatFingerprintDigits(secondFp);
  const displayString = [...firstGroups, ...secondGroups].join(" ");

  return { displayString, fingerprint };
}
