// ── Per-System Entity Quotas ────────────────────────────────────────

/** Maximum non-archived members per system. */
export const MAX_MEMBERS_PER_SYSTEM = 5_000;

/** Maximum non-archived groups per system. */
export const MAX_GROUPS_PER_SYSTEM = 200;

/** Maximum non-archived notes per system. */
export const MAX_NOTES_PER_SYSTEM = 5_000;

/** Maximum non-archived custom fronts per system. */
export const MAX_CUSTOM_FRONTS_PER_SYSTEM = 200;

/** Maximum non-archived channels per system (includes categories). */
export const MAX_CHANNELS_PER_SYSTEM = 50;

/**
 * Field definition limit per system.
 *
 * See also: `docs/api-limits.md`
 */
export const MAX_FIELD_DEFINITIONS_PER_SYSTEM = 200;

/** Maximum non-archived innerworld entities per system. */
export const MAX_INNERWORLD_ENTITIES_PER_SYSTEM = 500;

/** Maximum non-archived innerworld regions per system. */
export const MAX_INNERWORLD_REGIONS_PER_SYSTEM = 100;

/** Maximum non-archived photos across all members in a system. */
export const MAX_PHOTOS_PER_SYSTEM = 500;

/** Maximum non-archived privacy buckets per system. */
export const MAX_BUCKETS_PER_SYSTEM = 50;

/** Maximum non-archived webhook configs per system. */
export const MAX_WEBHOOK_CONFIGS_PER_SYSTEM = 25;

// ── Per-Entity Quotas ───────────────────────────────────────────────

/** Maximum photos per member. */
export const MAX_PHOTOS_PER_MEMBER = 5;

// ── Per-Account Quotas ──────────────────────────────────────────────

/** Maximum number of active (non-archived) friend codes per account. */
export const MAX_FRIEND_CODES_PER_ACCOUNT = 10;

/** Maximum concurrent active sessions per account. Oldest session is evicted when exceeded. */
export const MAX_SESSIONS_PER_ACCOUNT = 50;

/**
 * Maximum number of sessions to fetch for analytics computation.
 * Analytics queries operate over a time range; this cap prevents
 * runaway reads on extremely active systems.
 */
export const MAX_ANALYTICS_SESSIONS = 10_000;
