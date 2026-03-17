/**
 * System-route constants.
 * Domain: system profile CRUD routes and service layer.
 */

// ── Size Limits ────────────────────────────────────────────────────

/** Maximum size of encrypted profile data in bytes (64 KiB). */
export const MAX_ENCRYPTED_DATA_BYTES = 65_536;

// ── Pagination ─────────────────────────────────────────────────────

/** Default page size for system listing. */
export const DEFAULT_SYSTEM_LIMIT = 25;

/** Maximum page size for system listing. */
export const MAX_SYSTEM_LIMIT = 100;
