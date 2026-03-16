export const MAX_AUTOMERGE_HEADS_BYTES = 16_384;
export const MAX_ERROR_LOG_ENTRIES = 1_000;
/** 10 GiB (10 * 1024^3). Upper bound for blob_metadata.size_bytes. */
export const MAX_BLOB_SIZE_BYTES = 10_737_418_240;
export const ID_MAX_LENGTH = 50;
// Longest current enum value is 39 chars (e.g. "device.security.jailbreak_warning_shown").
// 50 provides reasonable headroom while still catching unbounded strings.
export const ENUM_MAX_LENGTH = 50;
/** Maximum length for audit log detail text. */
export const AUDIT_LOG_DETAIL_MAX_LENGTH = 2_048;
/** Maximum length for webhook/callback URLs. */
export const URL_MAX_LENGTH = 2_048;
