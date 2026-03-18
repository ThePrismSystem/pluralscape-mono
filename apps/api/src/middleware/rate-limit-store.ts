export interface RateLimitResult {
  /** Current count after increment. */
  count: number;
  /** UnixMillis when the current window resets. */
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitResult>;
}
