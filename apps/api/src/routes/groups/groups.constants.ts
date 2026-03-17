/**
 * Group-route constants.
 * Domain: group CRUD routes and service layer.
 */

// ── Size Limits ────────────────────────────────────────────────────

/** Maximum size of encrypted group data in bytes (64 KiB). */
export const MAX_ENCRYPTED_DATA_BYTES = 65_536;

// ── Pagination ─────────────────────────────────────────────────────

/** Default page size for group listing. */
export const DEFAULT_GROUP_LIMIT = 25;

/** Maximum page size for group listing. */
export const MAX_GROUP_LIMIT = 100;

// ── Hierarchy ──────────────────────────────────────────────────────

/** Safety cap for ancestor walk cycle detection. */
export const MAX_ANCESTOR_DEPTH = 50;
