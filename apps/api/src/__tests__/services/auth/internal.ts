/**
 * Shared types used across auth test files.
 * Named internal.ts per the ≥2 consumers rule.
 */

/** Shape of the object passed to `chain.set()` when revoking a session. */
export interface SessionRevocation {
  revoked: boolean;
}
