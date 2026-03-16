/** KDF context for blob data keys (must be exactly 8 bytes). */
export const KDF_CONTEXT_BLOB = "blobdata";

/** KDF sub-key ID for blob encryption. */
export const SUBKEY_BLOB_ENCRYPTION = 2;

/** Size of a uint32 in bytes. */
export const U32_SIZE = 4;

/** Threshold for switching to streaming encryption (64 KiB). */
export const STREAM_THRESHOLD = 65_536;

/** Maximum number of stream chunks allowed during deserialization. */
export const MAX_STREAM_CHUNKS = 65_536;
