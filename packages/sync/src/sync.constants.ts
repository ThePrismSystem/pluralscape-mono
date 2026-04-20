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
export const DEFAULT_COMPACTION_SIZE_BYTES = 1 * MiB;

// ── Time-split thresholds ───────────────────────────────────────────

/** Time-split threshold for fronting documents: 5 MiB. */
export const FRONTING_SPLIT_THRESHOLD_BYTES = 5 * MiB;

/** Time-split threshold for chat documents: 5 MiB. */
export const CHAT_SPLIT_THRESHOLD_BYTES = 5 * MiB;

/** Time-split threshold for journal documents: 10 MiB. */
export const JOURNAL_SPLIT_THRESHOLD_BYTES = 10 * MiB;

/** Time-split threshold for note documents: 10 MiB. */
export const NOTE_SPLIT_THRESHOLD_BYTES = 10 * MiB;

// ── Document size limits ────────────────────────────────────────────

/** Maximum size for system-core documents: 10 MiB. */
export const SYSTEM_CORE_SIZE_LIMIT_BYTES = 10 * MiB;

/** Maximum size for fronting documents: 20 MiB. */
export const FRONTING_SIZE_LIMIT_BYTES = 20 * MiB;

/** Maximum size for chat documents: 20 MiB. */
export const CHAT_SIZE_LIMIT_BYTES = 20 * MiB;

/** Maximum size for journal documents: 50 MiB. */
export const JOURNAL_SIZE_LIMIT_BYTES = 50 * MiB;

/** Maximum size for note documents: 15 MiB. */
export const NOTE_SIZE_LIMIT_BYTES = 15 * MiB;

/** Maximum size for privacy-config documents: 5 MiB. */
export const PRIVACY_CONFIG_SIZE_LIMIT_BYTES = 5 * MiB;

/** Maximum size for bucket documents: 5 MiB. */
export const BUCKET_SIZE_LIMIT_BYTES = 5 * MiB;

// ── Storage budget ──────────────────────────────────────────────────

/** Default hosted storage budget: 500 MiB. */
export const DEFAULT_STORAGE_BUDGET_BYTES = 500 * MiB;

// ── Compaction threshold ───────────────────────────────────────────

/** Default number of changes since last snapshot before compaction is eligible. */
export const DEFAULT_COMPACTION_CHANGE_THRESHOLD = 200;

// ── Document factory defaults ──────────────────────────────────────

/** Default font scale for system settings. */
export const DEFAULT_FONT_SCALE = 1;

/** Default app-lock timeout in minutes. */
export const DEFAULT_LOCK_TIMEOUT_MINUTES = 5;

/** Default background grace period in seconds before app-lock engages. */
export const DEFAULT_BACKGROUND_GRACE_SECONDS = 60;

// ── Replication profile defaults ───────────────────────────────────

/** Default active channel window for owner-lite profile in days. */
export const DEFAULT_ACTIVE_CHANNEL_WINDOW_DAYS = 30;

// ── Sync engine ────────────────────────────────────────────────────

/** Maximum parallel document hydrations during bootstrap. */
export const HYDRATION_CONCURRENCY = 5;

/** Maximum parallel document evictions during bootstrap. */
export const EVICTION_CONCURRENCY = 5;

/** Maximum number of failed conflict persistence batches retained for retry. */
export const MAX_CONFLICT_RETRY_BATCHES = 100;

/** Maximum parallel correction envelope submissions. */
export const CORRECTION_ENVELOPE_CONCURRENCY = 5;

// ── Offline queue replay ───────────────────────────────────────────

/** Maximum number of retries per entry before giving up. */
export const MAX_RETRIES_PER_ENTRY = 3;

/** Base delay in ms for exponential backoff. */
export const BACKOFF_BASE_MS = 500;

/** Maximum number of documents replayed concurrently. */
export const REPLAY_DOCUMENT_CONCURRENCY = 3;

/** Minimum jitter multiplier applied to backoff delay. */
export const JITTER_MIN = 0.5;

/** Maximum jitter multiplier applied to backoff delay. */
export const JITTER_MAX = 1.0;

// ── Offline queue drain ───────────────────────────────────────────

/** Maximum number of queue entries fetched per drain batch. */
export const DRAIN_BATCH_SIZE = 500;

// ── Offline queue ─────────────────────────────────────────────────

/** Prefix for offline queue entry IDs. */
export const OFFLINE_QUEUE_ID_PREFIX = "oq_";

// ── Protocol ──────────────────────────────────────────────────────

/** Current sync protocol version. Declared in AuthenticateRequest. */
export const SYNC_PROTOCOL_VERSION = 1;
