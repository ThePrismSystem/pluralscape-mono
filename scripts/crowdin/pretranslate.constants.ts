/** Interval between polls of an in-flight pretranslate job. */
export const POLL_INTERVAL_MS = 5_000;
/** Maximum wall-clock time to wait for a single pretranslate job. */
export const POLL_TIMEOUT_MS = 10 * 60 * 1_000;
/** Pretranslate methods supported by Crowdin; we use TM for pass 1 and MT for pass 2. */
export const PRETRANSLATE_METHODS = ["tm", "mt"] as const;
export type PretranslateMethod = (typeof PRETRANSLATE_METHODS)[number];
