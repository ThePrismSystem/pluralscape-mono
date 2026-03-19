/**
 * Sliding window rate limiter using the weighted previous-window approach.
 *
 * Interpolates between the current and previous window counts to produce
 * a smooth, burst-tolerant rate limit check.
 */

/** Mutable rate limiting state for a single window type (mutation or read). */
export class SlidingWindowCounter {
  count = 0;
  previousCount = 0;
  windowStart = 0;

  /**
   * Record a request and check whether the effective count exceeds the limit.
   *
   * Returns `true` if the request is within the limit, `false` if over.
   */
  check(now: number, windowMs: number, limit: number): boolean {
    const doubleWindow = 2;
    if (now - this.windowStart >= doubleWindow * windowMs) {
      // Both windows expired
      this.previousCount = 0;
      this.count = 0;
      this.windowStart += windowMs * Math.floor((now - this.windowStart) / windowMs);
    } else if (now - this.windowStart >= windowMs) {
      // Current window expired — rotate
      this.previousCount = this.count;
      this.count = 0;
      this.windowStart += windowMs;
    }
    this.count++;

    // Interpolate: weight previous window by overlap fraction
    const elapsed = now - this.windowStart;
    const weight = Math.max(0, 1 - elapsed / windowMs);
    const effectiveCount = this.previousCount * weight + this.count;

    return effectiveCount <= limit;
  }
}
