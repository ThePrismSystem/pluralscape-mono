/**
 * System-route constants.
 * Domain: system profile CRUD routes and service layer.
 */

// ── HTTP Status Codes ──────────────────────────────────────────────

/** HTTP 200 OK. */
export const HTTP_OK = 200;

/** HTTP 201 Created. */
export const HTTP_CREATED = 201;

/** HTTP 400 Bad Request. */
export const HTTP_BAD_REQUEST = 400;

/** HTTP 403 Forbidden. */
export const HTTP_FORBIDDEN = 403;

/** HTTP 404 Not Found. */
export const HTTP_NOT_FOUND = 404;

/** HTTP 409 Conflict. */
export const HTTP_CONFLICT = 409;

// ── Size Limits ────────────────────────────────────────────────────

/** Maximum size of encrypted profile data in bytes (64 KiB). */
export const MAX_ENCRYPTED_DATA_BYTES = 65_536;
