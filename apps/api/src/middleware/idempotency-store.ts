/** Shape of a cached idempotency response. */
export interface CachedResponse {
  readonly statusCode: number;
  readonly body: string;
}

/** Storage backend for idempotency key middleware. */
export interface IdempotencyStore {
  get(accountId: string, key: string): Promise<CachedResponse | null>;
  set(accountId: string, key: string, response: CachedResponse): Promise<void>;
  acquireLock(accountId: string, key: string): Promise<boolean>;
  releaseLock(accountId: string, key: string): Promise<void>;
}
