import {
  KDF_KEY_BYTES,
  PWHASH_MEMLIMIT_INTERACTIVE,
  PWHASH_MEMLIMIT_MOBILE,
  PWHASH_OPSLIMIT_MOBILE,
  PWHASH_OPSLIMIT_MODERATE,
  PWHASH_SALT_BYTES,
} from "./constants.js";
import { InvalidInputError } from "./errors.js";
import { getSodium } from "./sodium.js";
import { decrypt, encrypt } from "./symmetric.js";
import { assertKdfMasterKey } from "./validation.js";

import type { PwhashProfile } from "./master-key.js";
import type { EncryptedPayload } from "./symmetric.js";
import type { AeadKey, KdfMasterKey, PwhashSalt } from "./types.js";

interface ProfileParams {
  readonly opsLimit: number;
  readonly memLimit: number;
}

const PROFILE_PARAMS: Readonly<Record<PwhashProfile, ProfileParams>> = {
  server: { opsLimit: PWHASH_OPSLIMIT_MODERATE, memLimit: PWHASH_MEMLIMIT_INTERACTIVE },
  mobile: { opsLimit: PWHASH_OPSLIMIT_MOBILE, memLimit: PWHASH_MEMLIMIT_MOBILE },
};

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

/** Number of hex characters per byte. */
const HEX_CHARS_PER_BYTE = 2;

/** Radix for hexadecimal parsing. */
const HEX_RADIX = 16;

// ── Hex encoding (cross-platform, no external deps) ─────────────────────────

/** Encode bytes to a lowercase hex string. */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(HEX_RADIX).padStart(HEX_CHARS_PER_BYTE, "0")).join("");
}

/** Decode a hex string to bytes. */
function fromHex(hex: string): Uint8Array {
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
  readonly salt: Uint8Array;
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
  const rawBytes = adapter.randomBytes(TRANSFER_CODE_RANDOM_BYTES);
  const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
  const codeInt = view.getUint32(0, true) % TRANSFER_CODE_MAX;
  const verificationCode = String(codeInt).padStart(TRANSFER_CODE_LENGTH, "0");
  const codeSalt = adapter.randomBytes(PWHASH_SALT_BYTES) as PwhashSalt;
  const requestId = crypto.randomUUID();
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
    return raw as AeadKey;
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

/** Encode a TransferInitiation as a JSON string for QR code embedding. */
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
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("requestId" in parsed) ||
    !("code" in parsed) ||
    !("salt" in parsed) ||
    typeof (parsed as Record<string, unknown>).requestId !== "string" ||
    typeof (parsed as Record<string, unknown>).code !== "string" ||
    typeof (parsed as Record<string, unknown>).salt !== "string"
  ) {
    throw new InvalidInputError("QR payload missing required fields: requestId, code, salt.");
  }
  const {
    requestId,
    code,
    salt: saltHex,
  } = parsed as {
    requestId: string;
    code: string;
    salt: string;
  };
  const salt = fromHex(saltHex);
  return { requestId, code, salt };
}

/**
 * Check whether a transfer code string has the correct format (8 decimal digits).
 */
export function isValidTransferCode(code: string): boolean {
  return TRANSFER_CODE_PATTERN.test(code);
}
