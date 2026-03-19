/**
 * Sliding window rate limiter using the weighted previous-window approach.
 *
 * Interpolates between the current and previous window counts to produce
 * a smooth, burst-tolerant rate limit check.
 */

/** Mutable rate limiting state for a single window type (mutation or read). */
export class SlidingWindowCounter {
  private count = 0;
  private previousCount = 0;
  private windowStart = 0;

  /** Set internal state for test setup. */
  seed(count: number, previousCount: number, windowStart: number): void {
    this.count = count;
    this.previousCount = previousCount;
    this.windowStart = windowStart;
  }

  /** Read-only snapshot of internal state for test assertions. */
  snapshot(): {
    readonly count: number;
    readonly previousCount: number;
    readonly windowStart: number;
  } {
    return { count: this.count, previousCount: this.previousCount, windowStart: this.windowStart };
  }

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
