/**
 * Validation-layer constants.
 * Domain: schema validation rules shared across packages.
 */

import type { DeviceTokenPlatform, FriendNotificationEventType } from "@pluralscape/types";

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
 * Maximum entries per import-entity-ref batch lookup or upsert request.
 * Caps payload size to keep round-trips small and prevent unbounded
 * server-side work during mobile imports.
 */
export const IMPORT_ENTITY_REF_BATCH_MAX = 200;

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

/** Maximum analytics custom date range span in milliseconds (366 days). */
export const MAX_ANALYTICS_CUSTOM_RANGE_MS = 366 * 86_400_000;

/** Maximum character length for webhook target URLs. Matches DB URL_MAX_LENGTH. */
export const MAX_WEBHOOK_URL_LENGTH = 2048;

/** Maximum number of friend connections returned per page. */
export const FRIEND_CONNECTION_MAX_LIMIT = 100;

/** Default number of friend connections returned per page when not specified. */
export const FRIEND_CONNECTION_DEFAULT_LIMIT = 50;

/** Maximum number of event types a single webhook config can subscribe to. */
export const MAX_WEBHOOK_EVENT_TYPES = 50;

/** All valid webhook event type values, used for Zod enum validation. */
export const WEBHOOK_EVENT_TYPE_VALUES = [
  "member.created",
  "member.updated",
  "member.archived",
  "fronting.started",
  "fronting.ended",
  "group.created",
  "group.updated",
  "lifecycle.event-recorded",
  "custom-front.changed",
  "channel.created",
  "channel.updated",
  "channel.archived",
  "channel.restored",
  "channel.deleted",
  "message.created",
  "message.updated",
  "message.archived",
  "message.restored",
  "message.deleted",
  "board-message.created",
  "board-message.updated",
  "board-message.pinned",
  "board-message.unpinned",
  "board-message.reordered",
  "board-message.archived",
  "board-message.restored",
  "board-message.deleted",
  "note.created",
  "note.updated",
  "note.archived",
  "note.restored",
  "note.deleted",
  "poll.created",
  "poll.updated",
  "poll.closed",
  "poll.archived",
  "poll.restored",
  "poll.deleted",
  "poll-vote.cast",
  "poll-vote.vetoed",
  "poll-vote.updated",
  "poll-vote.archived",
  "acknowledgement.created",
  "acknowledgement.confirmed",
  "acknowledgement.archived",
  "acknowledgement.restored",
  "acknowledgement.deleted",
  "bucket.created",
  "bucket.updated",
  "bucket.archived",
  "bucket.restored",
  "bucket.deleted",
  "bucket-content-tag.tagged",
  "bucket-content-tag.untagged",
  "field-bucket-visibility.set",
  "field-bucket-visibility.removed",
  // ── Privacy: friends ──
  "friend.connected",
  "friend.removed",
  "friend.bucket-assigned",
  "friend.bucket-unassigned",
] as const;

/** Maximum length for Pluralscape entity IDs in import entity refs. Matches DB ID_MAX_LENGTH (50). */
export const MAX_PLURALSCAPE_ENTITY_ID_LENGTH = 50;

/** Maximum character length for device push tokens (APNs/FCM/web-push). */
export const MAX_DEVICE_TOKEN_LENGTH = 512;

/** Maximum character length for free-form query parameter string fields (entity IDs, event types, resource types). */
export const MAX_QUERY_PARAM_STRING_LENGTH = 256;

/** Maximum character length for opaque pagination cursor strings. */
export const MAX_CURSOR_LENGTH = 1024;

/** All valid device token platform values, used for Zod enum validation. */
export const DEVICE_TOKEN_PLATFORM_VALUES = [
  "ios",
  "android",
  "web",
] as const satisfies readonly DeviceTokenPlatform[];

/** All valid friend notification event type values, used for Zod enum validation. */
export const FRIEND_NOTIFICATION_EVENT_TYPE_VALUES = [
  "friend-switch-alert",
] as const satisfies readonly FriendNotificationEventType[];
