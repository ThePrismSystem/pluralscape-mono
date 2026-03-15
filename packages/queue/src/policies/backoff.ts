import type { RetryPolicy } from "@pluralscape/types";

/**
 * Calculates the backoff delay in milliseconds for a given retry attempt.
 *
 * @param policy - The retry policy containing backoff configuration.
 * @param attempt - The attempt number (1-based: first retry = 1).
 * @returns Backoff delay in milliseconds, capped at `policy.maxBackoffMs`.
 */
export function calculateBackoff(policy: RetryPolicy, attempt: number): number {
  const strategy = policy.strategy ?? "exponential";

  let delay: number;
  if (strategy === "linear") {
    delay = policy.backoffMs * attempt;
  } else {
    delay = policy.backoffMs * Math.pow(policy.backoffMultiplier, attempt - 1);
  }

  const jf = policy.jitterFraction ?? 0;
  if (jf > 0) {
    const range = delay * jf;
    delay = delay - range + Math.random() * 2 * range;
  }

  return Math.min(Math.max(0, Math.round(delay)), policy.maxBackoffMs);
}
