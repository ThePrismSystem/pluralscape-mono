/**
 * Device transfer protocol — transfers encrypted master key between devices.
 *
 * Security model:
 * - Verification code: 10 decimal digits (~33.2 bits entropy)
 * - Protected by Argon2id TRANSFER profile (see `crypto.constants.ts`) to slow brute force
 * - Transfer sessions expire after 5 minutes (TRANSFER_TIMEOUT_MS)
 * - QR payload carries only {requestId, salt}. The verification code must be entered
 *   manually on the target device. This two-factor split closes the MITM/photography
 *   window: capturing the QR alone is insufficient to derive the transfer key.
 * - Offline brute force of the full code space is computationally expensive
 *   (~2,800 hours on a single 2024-era GPU per hashcat benchmarks) and mitigated
 *   by the 5-minute server-side timeout for online attacks
 */

import {
  ARGON2ID_PROFILE_TRANSFER,
  KDF_KEY_BYTES,
  PWHASH_SALT_BYTES,
  assertArgon2idProfile,
} from "./crypto.constants.js";
import { InvalidInputError } from "./errors.js";
import { fromHex, toHex } from "./hex.js";
import { getSodium } from "./sodium.js";
import { decrypt, encrypt } from "./symmetric.js";
import { assertAeadKey, assertKdfMasterKey, assertPwhashSalt } from "./validation.js";

import type { EncryptedPayload } from "./symmetric.js";
import type { AeadKey, KdfMasterKey, PwhashSalt } from "./types.js";

/** Number of digits in a transfer code. */
const TRANSFER_CODE_LENGTH = 10;

/** Number of random bytes used to generate a transfer code (8 bytes for BigInt range). */
const TRANSFER_CODE_RANDOM_BYTES = 8;

/** Maximum decimal value of the transfer code (10^10). */
const TRANSFER_CODE_MAX = 10_000_000_000n;

/** Transfer sessions expire after 5 minutes. */
export const TRANSFER_TIMEOUT_MS = 300_000;

/** Transfer code validation pattern — exactly 10 decimal digits. */
const TRANSFER_CODE_PATTERN = /^\d{10}$/;

/**
 * QR payload schema version. Currently v2: `{ version, requestId, salt }`.
 * v1 (`{ requestId, code, salt }`) is rejected — see ADR 024 / threat model
 * L6 for the rationale behind removing the verification code from the QR.
 */
export const QR_PAYLOAD_VERSION = 2;

/**
 * Maximum byte length accepted by `decodeQRPayload`.
 *
 * Real payloads are ~150 bytes (UUID + hex-encoded 16-byte salt + wrapping
 * JSON). 1 KiB is generously above that while still cheap enough to reject
 * malformed input without full `JSON.parse` on megabyte-scale strings.
 */
const QR_PAYLOAD_MAX_LENGTH = 1024;

/** Multiplier to combine two uint32 values into a 64-bit BigInt (2^32). */
const UINT32_MULTIPLIER = 0x100000000n;

/** Byte offset for the second uint32 in an 8-byte buffer. */
const UINT32_SECOND_OFFSET = 4;

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

// ── Public types ────────────────────────────────────────────────────────────

/** Result of initiating a device transfer. */
export interface TransferInitiation {
  /** 10-digit numeric verification code shown to the user. */
  readonly verificationCode: string;
  /** Salt used to derive the transfer key via Argon2id. */
  readonly codeSalt: PwhashSalt;
  /** Unique request identifier for server relay. */
  readonly requestId: string;
}

/**
 * Decoded QR payload fields.
 *
 * The QR code intentionally does not carry the verification code; the target device
 * must obtain the 10-digit code through a separate out-of-band channel (manual entry)
 * before deriving the transfer key via {@link deriveTransferKey}.
 */
export interface DecodedQRPayload {
  readonly requestId: string;
  readonly salt: PwhashSalt;
}

// ── Internal helpers ────────────────────────────────────────────────────────

/** Generate an unbiased random integer in [0, TRANSFER_CODE_MAX) via rejection sampling. */
function generateUniformCode(): bigint {
  const adapter = getSodium();
  const uint64Range = UINT32_MULTIPLIER * UINT32_MULTIPLIER; // 2^64
  const maxUnbiased = (uint64Range / TRANSFER_CODE_MAX) * TRANSFER_CODE_MAX;
  for (;;) {
    const rawBytes = adapter.randomBytes(TRANSFER_CODE_RANDOM_BYTES);
    const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
    const a = BigInt(view.getUint32(0, true));
    const b = BigInt(view.getUint32(UINT32_SECOND_OFFSET, true));
    const value = a * UINT32_MULTIPLIER + b;
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

/** Type guard for the expected shape of a parsed v2 QR payload. */
function isQRPayloadShape(
  v: unknown,
): v is { version: typeof QR_PAYLOAD_VERSION; requestId: string; salt: string } {
  if (typeof v !== "object" || v === null) return false;
  // Narrow per-field `as { field?: unknown }` probes are the canonical
  // TS ≥4.9 idiom for validating an untrusted JSON shape without the loose
  // `Record<string, unknown>` cast banned by house rules.
  if ((v as { version?: unknown }).version !== QR_PAYLOAD_VERSION) return false;
  if (typeof (v as { requestId?: unknown }).requestId !== "string") return false;
  if (typeof (v as { salt?: unknown }).salt !== "string") return false;
  return true;
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
  const verificationCode = generateUniformCode().toString().padStart(TRANSFER_CODE_LENGTH, "0");
  const requestId = generateUUIDv4();
  return { verificationCode, codeSalt, requestId };
}

/**
 * Derive a symmetric transfer key from a transfer code and salt using Argon2id.
 *
 * Argon2id is used (rather than HKDF) because the transfer code has only ~33.2 bits
 * of entropy (10 decimal digits), making brute-force expensive.
 *
 * Both devices must call this with the same code and salt to obtain the same key.
 */
export function deriveTransferKey(code: string, salt: PwhashSalt): AeadKey {
  if (!isValidTransferCode(code)) {
    throw new InvalidInputError(
      `Transfer code must be exactly ${String(TRANSFER_CODE_LENGTH)} decimal digits.`,
    );
  }
  const adapter = getSodium();
  assertArgon2idProfile(ARGON2ID_PROFILE_TRANSFER);
  const codeBytes = new TextEncoder().encode(code);
  try {
    const raw = adapter.pwhash(
      KDF_KEY_BYTES,
      codeBytes,
      salt,
      ARGON2ID_PROFILE_TRANSFER.opslimit,
      ARGON2ID_PROFILE_TRANSFER.memlimit,
    );
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
 * The QR carries `{ version, requestId, salt }`. The 10-digit verification
 * code is NOT embedded: it must be entered manually on the target device,
 * forming the second factor alongside the QR-delivered salt. This closes the
 * MITM/photography window where a passive observer capturing the QR alone
 * could derive the transfer key. The `version` field lets the decoder reject
 * pre-v2 layouts up-front (see {@link QR_PAYLOAD_VERSION}).
 */
export function encodeQRPayload(init: TransferInitiation): string {
  const saltHex = toHex(init.codeSalt);
  return JSON.stringify({
    version: QR_PAYLOAD_VERSION,
    requestId: init.requestId,
    salt: saltHex,
  });
}

/**
 * Decode a QR payload string back into its structured fields.
 *
 * Accepts only v2 payloads (`{ version: 2, requestId, salt }`); any payload
 * missing `version`, carrying a different version, or containing legacy
 * fields such as `code` is rejected. This is the enforcement point for
 * threat-model finding L6 — an older source device with a v1 payload would
 * have leaked the verification code inside the QR, so decoders must refuse
 * to interoperate with it.
 *
 * Throws InvalidInputError if the payload is over {@link QR_PAYLOAD_MAX_LENGTH}
 * bytes, is not valid JSON, or is missing / malformed required fields.
 */
export function decodeQRPayload(data: string): DecodedQRPayload {
  if (data.length > QR_PAYLOAD_MAX_LENGTH) {
    throw new InvalidInputError(
      `QR payload exceeds maximum length of ${String(QR_PAYLOAD_MAX_LENGTH)} bytes.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(data) as unknown;
  } catch (error: unknown) {
    throw new InvalidInputError("QR payload is not valid JSON.", { cause: error });
  }
  if (!isQRPayloadShape(parsed)) {
    throw new InvalidInputError(
      `QR payload is not a valid v${String(QR_PAYLOAD_VERSION)} schema (missing version, requestId, or salt).`,
    );
  }
  if (Object.hasOwn(parsed, "code")) {
    // A v1 payload would embed the 10-digit code in the QR. Refusing to
    // decode it enforces the two-factor split from ADR 024 / L6.
    throw new InvalidInputError("QR payload contains forbidden legacy `code` field.");
  }
  const salt = fromHex(parsed.salt);
  assertPwhashSalt(salt);
  return { requestId: parsed.requestId, salt };
}

/**
 * Check whether a transfer code string has the correct format (10 decimal digits).
 */
export function isValidTransferCode(code: string): boolean {
  return TRANSFER_CODE_PATTERN.test(code);
}
