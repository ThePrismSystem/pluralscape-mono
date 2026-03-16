import { KDF_KEY_BYTES, PWHASH_SALT_BYTES } from "./crypto.constants.js";
import { InvalidInputError } from "./errors.js";
import { PROFILE_PARAMS, type PwhashProfile } from "./master-key.js";
import { getSodium } from "./sodium.js";
import { decrypt, encrypt } from "./symmetric.js";
import { assertAeadKey, assertKdfMasterKey, assertPwhashSalt } from "./validation.js";

import type { EncryptedPayload } from "./symmetric.js";
import type { AeadKey, KdfMasterKey, PwhashSalt } from "./types.js";

/** Number of digits in a transfer code. */
const TRANSFER_CODE_LENGTH = 8;

/** Number of random bytes used to generate a transfer code. */
const TRANSFER_CODE_RANDOM_BYTES = 4;

/** Maximum decimal value of the transfer code (10^8). */
const TRANSFER_CODE_MAX = 100_000_000;

/** Transfer sessions expire after 5 minutes. */
export const TRANSFER_TIMEOUT_MS = 300_000;

/** Transfer code validation pattern — exactly 8 decimal digits. */
const TRANSFER_CODE_PATTERN = /^\d{8}$/;

/** Maximum uint32 value + 1 (2^32). */
const UINT32_RANGE = 0x100000000;

/** Number of random bytes for UUID v4 generation. */
const UUID_RANDOM_BYTES = 16;

/** RFC 4122 UUID v4: version nibble mask. */
const UUID_V4_VERSION_MASK = 0x0f;

/** RFC 4122 UUID v4: version bits (0100 xxxx). */
const UUID_V4_VERSION_BITS = 0x40;

/** RFC 4122: variant mask. */
const UUID_VARIANT_MASK = 0x3f;

/** RFC 4122: variant bits (10xx xxxx). */
const UUID_VARIANT_BITS = 0x80;

/** Byte index for the UUID version nibble. */
const UUID_VERSION_BYTE_INDEX = 6;

/** Byte index for the UUID variant nibble. */
const UUID_VARIANT_BYTE_INDEX = 8;

// UUID v4 section byte offsets for 8-4-4-4-12 grouping.
const UUID_SECTION_1_END = 4;
const UUID_SECTION_2_END = 6;
const UUID_SECTION_3_END = 8;
const UUID_SECTION_4_END = 10;
const UUID_SECTION_5_END = 16;

/** Number of hex characters per byte. */
const HEX_CHARS_PER_BYTE = 2;

/** Radix for hexadecimal parsing. */
const HEX_RADIX = 16;

// ── Hex encoding (cross-platform, no external deps) ─────────────────────────

/** Encode bytes to a lowercase hex string. */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(HEX_RADIX).padStart(HEX_CHARS_PER_BYTE, "0")).join("");
}

/** Decode a hex string to bytes. Throws InvalidInputError on invalid hex. */
function fromHex(hex: string): Uint8Array {
  if (hex.length % HEX_CHARS_PER_BYTE !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new InvalidInputError("Invalid hex string.");
  }
  const bytes = new Uint8Array(hex.length / HEX_CHARS_PER_BYTE);
  for (let i = 0; i < bytes.length; i++) {
    const offset = i * HEX_CHARS_PER_BYTE;
    bytes[i] = parseInt(hex.slice(offset, offset + HEX_CHARS_PER_BYTE), HEX_RADIX);
  }
  return bytes;
}

// ── Public types ────────────────────────────────────────────────────────────

/** Result of initiating a device transfer. */
export interface TransferInitiation {
  /** 8-digit numeric verification code shown to the user. */
  readonly verificationCode: string;
  /** Salt used to derive the transfer key via Argon2id. */
  readonly codeSalt: PwhashSalt;
  /** Unique request identifier for server relay. */
  readonly requestId: string;
}

/** Decoded QR payload fields. */
export interface DecodedQRPayload {
  readonly requestId: string;
  readonly code: string;
  readonly salt: PwhashSalt;
}

// ── Internal helpers ────────────────────────────────────────────────────────

/** Generate an unbiased random integer in [0, TRANSFER_CODE_MAX) via rejection sampling. */
function generateUniformCode(): number {
  const adapter = getSodium();
  const maxUnbiased = Math.floor(UINT32_RANGE / TRANSFER_CODE_MAX) * TRANSFER_CODE_MAX;
  for (;;) {
    const rawBytes = adapter.randomBytes(TRANSFER_CODE_RANDOM_BYTES);
    const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
    const value = view.getUint32(0, true);
    if (value < maxUnbiased) return value % TRANSFER_CODE_MAX;
  }
}

/** Generate a UUID v4 using libsodium randomBytes (no Web Crypto dependency). */
function generateUUIDv4(): string {
  const adapter = getSodium();
  const bytes = adapter.randomBytes(UUID_RANDOM_BYTES);
  const versionByte = bytes[UUID_VERSION_BYTE_INDEX] ?? 0;
  bytes[UUID_VERSION_BYTE_INDEX] = (versionByte & UUID_V4_VERSION_MASK) | UUID_V4_VERSION_BITS;
  const variantByte = bytes[UUID_VARIANT_BYTE_INDEX] ?? 0;
  bytes[UUID_VARIANT_BYTE_INDEX] = (variantByte & UUID_VARIANT_MASK) | UUID_VARIANT_BITS;
  return [
    toHex(bytes.slice(0, UUID_SECTION_1_END)),
    toHex(bytes.slice(UUID_SECTION_1_END, UUID_SECTION_2_END)),
    toHex(bytes.slice(UUID_SECTION_2_END, UUID_SECTION_3_END)),
    toHex(bytes.slice(UUID_SECTION_3_END, UUID_SECTION_4_END)),
    toHex(bytes.slice(UUID_SECTION_4_END, UUID_SECTION_5_END)),
  ].join("-");
}

/** Type guard for the expected shape of a parsed QR payload. */
function isQRPayloadShape(v: unknown): v is { requestId: string; code: string; salt: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    "requestId" in v &&
    typeof (v as Record<string, unknown>).requestId === "string" &&
    "code" in v &&
    typeof (v as Record<string, unknown>).code === "string" &&
    "salt" in v &&
    typeof (v as Record<string, unknown>).salt === "string"
  );
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a transfer code, salt, and request ID to initiate a device transfer.
 *
 * The verificationCode must be displayed to the user on the source device
 * and entered on the target device. The requestId is used to correlate
 * the two sides via the server relay.
 */
export function generateTransferCode(): TransferInitiation {
  const adapter = getSodium();
  const codeSalt = adapter.randomBytes(PWHASH_SALT_BYTES) as PwhashSalt;
  const verificationCode = String(generateUniformCode()).padStart(TRANSFER_CODE_LENGTH, "0");
  const requestId = generateUUIDv4();
  return { verificationCode, codeSalt, requestId };
}

/**
 * Derive a symmetric transfer key from a transfer code and salt using Argon2id.
 *
 * Argon2id is used (rather than HKDF) because the transfer code has only ~26.5 bits
 * of entropy (8 decimal digits), making brute-force expensive.
 *
 * Both devices must call this with the same code and salt to obtain the same key.
 */
export function deriveTransferKey(
  code: string,
  salt: PwhashSalt,
  profile: PwhashProfile = "mobile",
): AeadKey {
  if (!isValidTransferCode(code)) {
    throw new InvalidInputError(
      `Transfer code must be exactly ${String(TRANSFER_CODE_LENGTH)} decimal digits.`,
    );
  }
  const adapter = getSodium();
  const codeBytes = new TextEncoder().encode(code);
  const { opsLimit, memLimit } = PROFILE_PARAMS[profile];
  try {
    const raw = adapter.pwhash(KDF_KEY_BYTES, codeBytes, salt, opsLimit, memLimit);
    assertAeadKey(raw);
    return raw;
  } finally {
    adapter.memzero(codeBytes);
  }
}

/**
 * Encrypt the MasterKey for transfer to another device.
 *
 * The transferKey is memzeroed in the finally block. The caller must not reuse it.
 */
export function encryptForTransfer(
  masterKey: KdfMasterKey,
  transferKey: AeadKey,
): EncryptedPayload {
  const adapter = getSodium();
  try {
    return encrypt(masterKey, transferKey);
  } finally {
    adapter.memzero(transferKey);
  }
}

/**
 * Decrypt the MasterKey received from another device.
 *
 * The transferKey is memzeroed in the finally block. The caller must not reuse it.
 * Throws DecryptionFailedError if the key is wrong or the payload is tampered.
 */
export function decryptFromTransfer(payload: EncryptedPayload, transferKey: AeadKey): KdfMasterKey {
  const adapter = getSodium();
  try {
    const raw = decrypt(payload, transferKey);
    assertKdfMasterKey(raw);
    return raw;
  } finally {
    adapter.memzero(transferKey);
  }
}

/**
 * Encode a TransferInitiation as a JSON string for QR code embedding.
 *
 * Note: The QR payload includes the verification code for convenience — scanning
 * the QR replaces manual code entry. Security relies on physical proximity to the
 * source device's screen. If two-factor verification is needed in the future,
 * remove the `code` field and require separate manual entry.
 */
export function encodeQRPayload(init: TransferInitiation): string {
  const saltHex = toHex(init.codeSalt);
  return JSON.stringify({
    requestId: init.requestId,
    code: init.verificationCode,
    salt: saltHex,
  });
}

/**
 * Decode a QR payload string back into its structured fields.
 *
 * Throws InvalidInputError if the payload is not valid JSON or is missing required fields.
 */
export function decodeQRPayload(data: string): DecodedQRPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data) as unknown;
  } catch (error: unknown) {
    throw new InvalidInputError("QR payload is not valid JSON.", { cause: error });
  }
  if (!isQRPayloadShape(parsed)) {
    throw new InvalidInputError("QR payload missing required fields: requestId, code, salt.");
  }
  const salt = fromHex(parsed.salt);
  assertPwhashSalt(salt);
  return { requestId: parsed.requestId, code: parsed.code, salt };
}

/**
 * Check whether a transfer code string has the correct format (8 decimal digits).
 */
export function isValidTransferCode(code: string): boolean {
  return TRANSFER_CODE_PATTERN.test(code);
}
