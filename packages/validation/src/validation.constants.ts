/**
 * Validation-layer constants.
 * Domain: schema validation rules shared across packages.
 */

/** Minimum password length enforced at the validation layer (mirrors crypto MIN_PASSWORD_LENGTH). */
export const AUTH_MIN_PASSWORD_LENGTH = 8;

/**
 * Maximum byte length for encrypted system data fields.
 * Set to 128 KiB (half the 256 KiB global body limit) to leave room for
 * other fields and JSON overhead.
 */
export const MAX_ENCRYPTED_SYSTEM_DATA_SIZE = 131_072;

/**
 * Maximum byte length for encrypted group data fields.
 * Set to 128 KiB (half the 256 KiB global body limit) to leave room for
 * other fields and JSON overhead.
 */
export const MAX_ENCRYPTED_GROUP_DATA_SIZE = 131_072;

/**
 * Maximum byte length for encrypted custom front data fields.
 * Set to 128 KiB (half the 256 KiB global body limit) to leave room for
 * other fields and JSON overhead.
 */
export const MAX_ENCRYPTED_CUSTOM_FRONT_DATA_SIZE = 131_072;

/** Maximum number of group reorder operations in a single batch request. */
export const MAX_REORDER_OPERATIONS = 100;
