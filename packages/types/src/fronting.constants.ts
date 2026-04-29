/**
 * Maximum length of FrontingSession.comment in characters.
 *
 * Constraint origin: Simply Plural's customStatus field is capped at
 * 50 characters; preserving compatibility with that schema makes
 * round-tripping SP exports lossless. Enforced at the
 * FrontingSessionEncryptedInputSchema validation boundary via Zod
 * refine; the brand carries the type, the schema carries the runtime
 * check.
 */
export const MAX_FRONTING_COMMENT_LENGTH = 50;
