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

  if (strategy === "linear") {
    return Math.min(policy.backoffMs * attempt, policy.maxBackoffMs);
  }

  return Math.min(
    policy.backoffMs * Math.pow(policy.backoffMultiplier, attempt - 1),
    policy.maxBackoffMs,
  );
}
