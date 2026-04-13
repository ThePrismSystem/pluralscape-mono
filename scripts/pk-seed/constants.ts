/**
 * Constants for the PK seed script. No runtime logic — values only.
 *
 * Time constants are expressed in milliseconds.
 */

/** PK API base URL. Overridable via PK_API_BASE_URL env var. */
export const PK_API_BASE_URL_DEFAULT = "https://api.pluralkit.me";

/** Delay between mutation requests (ms). PK allows ~3 writes/sec. */
export const MUTATION_DELAY_MS = 350;

/** Fetch timeout for every PK API call (ms). */
export const FETCH_TIMEOUT_MS = 30_000;

/** The two seed modes. */
export type PkMode = "minimal" | "adversarial";

/** Paths (relative to repo root) that the script reads/writes. */
export const PATHS = {
  manifest: (mode: PkMode) => `scripts/.pk-seed-${mode}-manifest.json`,
} as const;

/** PK entity types, in creation order. */
export const ENTITY_TYPES_IN_ORDER = ["members", "groups", "switches"] as const;
export type EntityTypeKey = (typeof ENTITY_TYPES_IN_ORDER)[number];

/** Time constants (ms) used by fixtures. */
export const ONE_HOUR_MS = 3_600_000;
export const ONE_DAY_MS = 86_400_000;
export const TWO_DAYS_MS = 172_800_000;
export const THREE_DAYS_MS = 259_200_000;
export const FIVE_DAYS_MS = 432_000_000;
export const SEVEN_DAYS_MS = 604_800_000;
