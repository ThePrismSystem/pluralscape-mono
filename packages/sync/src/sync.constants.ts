/**
 * Named constants for the sync package.
 * Byte values are expressed as derivations from base units for clarity.
 */

// ── Byte size helpers ───────────────────────────────────────────────

/** 1 KiB in bytes. */
export const KiB = 1_024;

/** 1 MiB in bytes. */
export const MiB = KiB * 1024;

// ── Compaction ──────────────────────────────────────────────────────

/** Default compaction size threshold: 1 MiB. */
export const DEFAULT_COMPACTION_SIZE_BYTES = MiB;

// ── Time-split thresholds ───────────────────────────────────────────

/** Time-split threshold for fronting documents: 5 MiB. */
export const FRONTING_SPLIT_THRESHOLD_BYTES = 5 * MiB;

/** Time-split threshold for chat documents: 5 MiB. */
export const CHAT_SPLIT_THRESHOLD_BYTES = 5 * MiB;

/** Time-split threshold for journal documents: 10 MiB. */
export const JOURNAL_SPLIT_THRESHOLD_BYTES = 10 * MiB;

// ── Document size limits ────────────────────────────────────────────

/** Maximum size for system-core documents: 10 MiB. */
export const SYSTEM_CORE_SIZE_LIMIT_BYTES = 10 * MiB;

/** Maximum size for fronting documents: 20 MiB. */
export const FRONTING_SIZE_LIMIT_BYTES = 20 * MiB;

/** Maximum size for chat documents: 20 MiB. */
export const CHAT_SIZE_LIMIT_BYTES = 20 * MiB;

/** Maximum size for journal documents: 50 MiB. */
export const JOURNAL_SIZE_LIMIT_BYTES = 50 * MiB;

/** Maximum size for privacy-config documents: 5 MiB. */
export const PRIVACY_CONFIG_SIZE_LIMIT_BYTES = 5 * MiB;

/** Maximum size for bucket documents: 5 MiB. */
export const BUCKET_SIZE_LIMIT_BYTES = 5 * MiB;

// ── Storage budget ──────────────────────────────────────────────────

/** Default hosted storage budget: 500 MiB. */
export const DEFAULT_STORAGE_BUDGET_BYTES = 500 * MiB;
