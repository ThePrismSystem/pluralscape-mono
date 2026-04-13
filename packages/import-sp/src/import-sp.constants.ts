/**
 * Constants for the Simply Plural import engine.
 *
 * Shared constants (CHECKPOINT_CHUNK_SIZE, MAX_WARNING_BUFFER_SIZE) are
 * re-exported from import-core. SP-specific constants live here.
 */

export { CHECKPOINT_CHUNK_SIZE, MAX_WARNING_BUFFER_SIZE } from "@pluralscape/import-core";

/** Maximum number of retry attempts for transient SP API failures. */
export const SP_API_MAX_RETRIES = 5;

/** Base backoff delay in milliseconds for SP API retries (doubles per attempt). */
export const SP_API_BACKOFF_BASE_MS = 1_000;

/** Hard cap on backoff delay in milliseconds. */
export const SP_API_BACKOFF_MAX_MS = 16_000;

/** Default per-request timeout for SP API calls in milliseconds. */
export const SP_API_REQUEST_TIMEOUT_MS = 30_000;

// ── SP CustomFieldType numeric enum values ────────────────────────────────────
// Sourced from SP's `typeConverters` array in
// `src/api/base/user/generateReports.ts`. Used in the exhaustive switch in
// field-definition.mapper.ts; extracted here to satisfy the no-magic-numbers
// lint rule.

/** SP custom-field type: plain text. */
export const SP_FIELD_TYPE_TEXT = 0;
/** SP custom-field type: colour picker. */
export const SP_FIELD_TYPE_COLOR = 1;
/** SP custom-field type: full date (YYYY-MM-DD). */
export const SP_FIELD_TYPE_DATE = 2;
/** SP custom-field type: month only. */
export const SP_FIELD_TYPE_MONTH = 3;
/** SP custom-field type: year only. */
export const SP_FIELD_TYPE_YEAR = 4;
/** SP custom-field type: month + year. */
export const SP_FIELD_TYPE_MONTH_YEAR = 5;
/** SP custom-field type: Unix timestamp. */
export const SP_FIELD_TYPE_TIMESTAMP = 6;
/** SP custom-field type: month + day (no year). */
export const SP_FIELD_TYPE_MONTH_DAY = 7;
