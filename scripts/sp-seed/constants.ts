/**
 * Constants for the SP seed script. No runtime logic — values only.
 *
 * Time constants are expressed in milliseconds. Bitmask values document
 * their source in the SP API repo (ApparyllisOrg/SimplyPluralApi) inline.
 */

/** SP API base URL. Overridable via SP_API_BASE_URL env var. */
export const SP_API_BASE_URL_DEFAULT = "https://api.apparyllis.com";

/** Baseline delay applied to every SP API call (ms). */
export const REQUEST_DELAY_MS = 100;

/** Additional delay applied on top of REQUEST_DELAY_MS for entity POSTs (ms). */
export const ENTITY_CREATION_DELAY_MS = 200;

/** Fetch timeout for every SP API call (ms). */
export const FETCH_TIMEOUT_MS = 30_000;

/** Hardcoded fallback password when neither .env.sp-test nor SP_TEST_PASSWORD is set. */
export const SP_TEST_PASSWORD_FALLBACK = "TestImport1!sp";

/** Environment variable name read for the test account password when the env file omits it. */
export const SP_TEST_PASSWORD_ENV_KEY = "SP_TEST_PASSWORD";

/** Full read+write+delete bitmask per src/modules/api/keys.ts:5-11. */
export const FULL_API_ACCESS_PERMISSION = 0x01 | 0x02 | 0x04; // = 7

/** Dummy ObjectId satisfying validateId on POST /v1/token/:id. */
export const DUMMY_OBJECT_ID = "000000000000000000000000";

/** The two seed modes. */
export type SpMode = "minimal" | "adversarial";

/** Paths (relative to repo root) that the script reads/writes. */
export const PATHS = {
  // envFile is shared across both modes (single combined file).
  envFile: ".env.sp-test",
  manifest: (mode: "minimal" | "adversarial") => `scripts/.sp-test-${mode}-manifest.json`,
  exportJson: (mode: "minimal" | "adversarial") => `scripts/.sp-test-${mode}-export.json`,
} as const;

/** Time constants (ms) used by fixtures. */
export const TWO_MINUTES_MS = 120_000;
export const FIVE_MINUTES_MS = 300_000;
export const TEN_MINUTES_MS = 600_000;
export const ONE_HOUR_MS = 3_600_000;
export const EIGHTY_MINUTES_MS = 4_800_000;
export const NINETY_MINUTES_MS = 5_400_000;
export const TWO_HOURS_MS = 7_200_000;
export const ONE_DAY_MS = 86_400_000;
export const TWO_DAYS_MS = 172_800_000;
export const THREE_DAYS_MS = 259_200_000;
export const FOUR_DAYS_MS = 345_600_000;
export const THIRTY_DAYS_MS = 2_592_000_000;
