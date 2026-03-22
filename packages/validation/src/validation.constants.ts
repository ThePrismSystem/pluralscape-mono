/**
 * Validation-layer constants.
 * Domain: schema validation rules shared across packages.
 */

/** Minimum password length enforced at the validation layer (mirrors crypto MIN_PASSWORD_LENGTH). */
export const AUTH_MIN_PASSWORD_LENGTH = 8;

/**
 * Maximum base64-encoded string length for encrypted data fields.
 * Equals Math.ceil(65_536 * 4/3) = 87_382 — the base64 encoding of 64 KiB,
 * aligned with the service-layer byte limit (MAX_ENCRYPTED_DATA_BYTES).
 */
export const MAX_ENCRYPTED_DATA_SIZE = 87_382;

/** Maximum number of group reorder operations in a single batch request. */
export const MAX_REORDER_OPERATIONS = 100;

/**
 * Maximum byte length for encrypted system data fields.
 * Set to 128 KiB (half the 256 KiB global body limit) to leave room for
 * other fields and JSON overhead.
 */
export const MAX_ENCRYPTED_SYSTEM_DATA_SIZE = 131_072;

/** Maximum length for locale strings (e.g. "en-US"). */
export const MAX_LOCALE_LENGTH = 255;

/** Maximum length for biometric token strings. */
export const MAX_BIOMETRIC_TOKEN_LENGTH = 4096;

/** Maximum byte length for encrypted member data (128 KiB). */
export const MAX_ENCRYPTED_MEMBER_DATA_SIZE = 131_072;

/** Maximum byte length for encrypted photo data (128 KiB). */
export const MAX_ENCRYPTED_PHOTO_DATA_SIZE = 131_072;

/** Maximum byte length for encrypted field definition data (32 KiB). */
export const MAX_ENCRYPTED_FIELD_DATA_SIZE = 32_768;

/** Maximum byte length for encrypted field value data (16 KiB). */
export const MAX_ENCRYPTED_FIELD_VALUE_SIZE = 16_384;

/** Maximum character length for custom architecture type values. */
export const MAX_CUSTOM_ARCHITECTURE_TYPE_LENGTH = 100;

/** Maximum length for recovery key input strings. */
export const MAX_RECOVERY_KEY_LENGTH = 200;

/** Maximum password length to prevent Argon2 DoS on unauthenticated endpoints. */
export const MAX_PASSWORD_LENGTH = 1024;

/** Maximum character length for webhook target URLs. Matches DB URL_MAX_LENGTH. */
export const MAX_WEBHOOK_URL_LENGTH = 2048;

/** Maximum number of event types a single webhook config can subscribe to. */
export const MAX_WEBHOOK_EVENT_TYPES = 15;

/** All valid webhook event type values, used for Zod enum validation. */
export const WEBHOOK_EVENT_TYPE_VALUES = [
  "member.created",
  "member.updated",
  "member.archived",
  "fronting.started",
  "fronting.ended",
  "group.created",
  "group.updated",
  "note.created",
  "note.updated",
  "chat.message-sent",
  "poll.created",
  "poll.closed",
  "acknowledgement.requested",
  "lifecycle.event-recorded",
  "custom-front.changed",
] as const;
