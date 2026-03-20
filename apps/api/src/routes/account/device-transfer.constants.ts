/**
 * Device transfer route constants.
 * Domain: device-transfer initiation, completion, and rate limiting.
 */

/** Maximum number of incorrect transfer code attempts before the transfer is expired. */
export const MAX_TRANSFER_CODE_ATTEMPTS = 5;

/** Maximum number of transfer initiations per account per window. */
export const TRANSFER_INITIATION_LIMIT = 3;

/** Milliseconds in one hour (60 * 60 * 1000). */
export const MS_PER_HOUR = 3_600_000;
