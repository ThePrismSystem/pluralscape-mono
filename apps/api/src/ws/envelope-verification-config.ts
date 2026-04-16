import { logger } from "../lib/logger.js";

/**
 * Whether to verify envelope signatures server-side.
 * Configurable via VERIFY_ENVELOPE_SIGNATURES env var for performance tuning.
 * Defaults to true (secure by default). Evaluated once at module load.
 */
const VERIFY_ENVELOPE_SIGNATURES = ((): boolean => {
  const envVal = process.env["VERIFY_ENVELOPE_SIGNATURES"];
  if (envVal === undefined) return true;
  const enabled = envVal !== "false" && envVal !== "0";
  if (!enabled) {
    logger.warn(
      "VERIFY_ENVELOPE_SIGNATURES is disabled — server will accept unsigned sync envelopes. " +
        "This weakens E2E encryption integrity. Only disable for performance profiling.",
    );
  }
  return enabled;
})();

export function shouldVerifyEnvelopeSignatures(): boolean {
  return VERIFY_ENVELOPE_SIGNATURES;
}
