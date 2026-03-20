/**
 * Default page size for field definition listing.
 *
 * Field definitions are per-system schema entries. Most systems define
 * fewer than 25 custom fields, so a single page suffices for the common case.
 */
export const DEFAULT_FIELD_LIMIT = 25;

/**
 * Maximum page size for field definition listing.
 *
 * The hard cap of 200 field definitions per system (enforced at creation)
 * means 100 per page requires at most 2 pages for a full traversal.
 */
export const MAX_FIELD_LIMIT = 100;
