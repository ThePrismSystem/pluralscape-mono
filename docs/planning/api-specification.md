# API Specification

Concrete operational parameters for the Pluralscape API. All numbers are defaults for the hosted deployment; self-hosted operators can override via environment variables where noted.

This document is the **single source of truth** for values that appear in both documentation and code. The corresponding constants file (`packages/types/src/api-constants.ts`) re-exports these numbers for use in implementation.

---

## 1. Rate Limits

All rate limits use a **fixed-window** algorithm (matching the existing `createRateLimiter` in `apps/api/src/middleware/rate-limit.ts`).

| Category                                 | Limit   | Window  | Rationale                                      |
| ---------------------------------------- | ------- | ------- | ---------------------------------------------- |
| Global default                           | 100 req | 60 s    | General abuse prevention                       |
| Auth (login, register, password-reset)   | 5 req   | 60 s    | Argon2id is ~250 ms/call; prevents brute-force |
| Auth (logout, session list)              | 20 req  | 60 s    | Less expensive but security-sensitive          |
| Device transfer                          | 10 req  | 60 s    | 8-digit codes with 5 min TTL; limits guessing  |
| Write operations (POST/PUT/PATCH/DELETE) | 60 req  | 60 s    | Prevents write amplification                   |
| Blob upload / presigned URL              | 20 req  | 60 s    | Expensive server-side operations               |
| Webhook management                       | 20 req  | 60 s    | Admin-only, infrequent                         |
| Data export                              | 2 req   | 3600 s  | Extremely expensive                            |
| Data import                              | 2 req   | 3600 s  | Equally expensive                              |
| Account purge                            | 1 req   | 86400 s | Irreversible                                   |
| Friend code generation                   | 10 req  | 60 s    | Prevents code flooding                         |
| Public API (API key auth)                | 60 req  | 60 s    | Third-party consumers                          |

### Response headers

All rate-limited responses include:

- `X-RateLimit-Limit` — maximum requests in the window
- `X-RateLimit-Remaining` — requests remaining in the current window
- `X-RateLimit-Reset` — Unix timestamp (seconds) when the window resets

When the limit is exceeded, the response is `429 Too Many Requests` with a `Retry-After` header (seconds until reset).

### Self-hosted overrides

Each category can be overridden via environment variables prefixed with `RATE_LIMIT_`. For example, `RATE_LIMIT_AUTH_LIMIT=10` and `RATE_LIMIT_AUTH_WINDOW_SECONDS=120` override the auth login/register/password-reset category.

---

## 2. Error Response Format

All API errors use a standardized response shape. This replaces the current `{ error: string }` format (safe to change — no external consumers exist yet).

```typescript
interface ApiErrorResponse {
  error: {
    code: string; // Machine-readable, SCREAMING_SNAKE_CASE
    message: string; // Human-readable; masked to generic text in production for 5xx
    details?: unknown; // Validation field errors; never included in production 5xx
  };
  requestId: string; // UUID v7 for debugging correlation
}
```

### Error code catalog

| Code                   | HTTP Status | Description                                                     |
| ---------------------- | ----------- | --------------------------------------------------------------- |
| `VALIDATION_ERROR`     | 400         | Request body or query parameter failed schema validation        |
| `INVALID_CURSOR`       | 400         | Pagination cursor is malformed or expired (>24 h)               |
| `INVALID_FRIEND_CODE`  | 400         | Friend code format is invalid                                   |
| `UNAUTHENTICATED`      | 401         | No valid session or API key provided                            |
| `SESSION_EXPIRED`      | 401         | Session exceeded absolute or idle TTL                           |
| `KEY_VERSION_STALE`    | 401         | Client is using an outdated encryption key version              |
| `FORBIDDEN`            | 403         | Authenticated but not authorized for this resource              |
| `SCOPE_INSUFFICIENT`   | 403         | API key lacks the required scope                                |
| `BUCKET_ACCESS_DENIED` | 403         | Privacy bucket access check failed                              |
| `NOT_FOUND`            | 404         | Resource does not exist or caller cannot access it              |
| `CONFLICT`             | 409         | Concurrent modification detected (ETag mismatch, duplicate key) |
| `ROTATION_IN_PROGRESS` | 409         | Bucket key rotation is active; write rejected                   |
| `FRIEND_CODE_EXPIRED`  | 410         | Friend code has passed its TTL                                  |
| `BLOB_TOO_LARGE`       | 413         | File exceeds the per-purpose size limit                         |
| `QUOTA_EXCEEDED`       | 413         | System storage quota would be exceeded                          |
| `RATE_LIMITED`         | 429         | Rate limit exceeded for this category                           |
| `INTERNAL_ERROR`       | 500         | Unhandled server error (message masked in production)           |
| `SERVICE_UNAVAILABLE`  | 503         | Temporary overload or maintenance                               |

### Privacy rule

To prevent resource enumeration, `401 Forbidden` and `404 Not Found` responses for entity lookups all return `NOT_FOUND` with HTTP 404. The server never reveals whether a resource exists to an unauthorized caller (fail-closed).

---

## 3. Pagination

### Cursor-based (default for all list endpoints)

| Parameter | Default | Maximum |
| --------- | ------- | ------- |
| `limit`   | 25      | 100     |

Cursors encode a `(timestamp, id)` tuple and expire after **24 hours**. An expired cursor returns `INVALID_CURSOR` (400).

### Offset-based (admin/analytics endpoints only)

| Parameter | Default | Maximum |
| --------- | ------- | ------- |
| `limit`   | 25      | 100     |
| `offset`  | 0       | 10,000  |

The offset cap prevents unbounded deep pagination. For datasets beyond 10,000 rows, consumers must use cursor-based pagination or date-range filtering.

### Total count

`totalCount` is `null` by default. Clients can opt in via `?include_count=true`, which triggers a `COUNT(*)` query. This is only permitted on tables with fewer than 100,000 rows; larger tables always return `null`.

### Time-series data

All time-series endpoints (fronting history, audit logs, activity feeds) use cursor-based pagination exclusively. Cursors encode `(timestamp, id)` to guarantee stable ordering even when timestamps collide.

---

## 4. Retry Semantics

### Server-side job retries

The canonical retry policies are defined in `packages/queue/src/policies/default-policies.ts`. Key policies:

| Job Type                                                                                                                                           | Max Retries | Backoff                   | Strategy    | Cap    |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------- | ----------- | ------ |
| `webhook-deliver`                                                                                                                                  | 5           | 30 s base, 4x multiplier  | exponential | 2 h    |
| `notification-send`                                                                                                                                | 3           | 5 s base, 1x multiplier   | linear      | 30 s   |
| `sync-push` / `sync-pull`                                                                                                                          | 3           | 1 s base, 2x multiplier   | exponential | 30 s   |
| `blob-upload`                                                                                                                                      | 3           | 2 s base, 4x multiplier   | exponential | 60 s   |
| `export-generate` / `import-process`                                                                                                               | 3           | 1 s base, 4x multiplier   | exponential | 60 s   |
| `account-purge`                                                                                                                                    | 3           | 60 s base, 5x multiplier  | exponential | 30 min |
| `report-generate`                                                                                                                                  | 3           | 1 s base, 4x multiplier   | exponential | 60 s   |
| Heavy maintenance (`blob-cleanup`, `analytics-compute`, `bucket-key-rotation`, `sync-queue-cleanup`, `audit-log-cleanup`, `partition-maintenance`) | 2           | 5 min base, 5x multiplier | exponential | 30 min |

**Jitter recommendation:** All policies should include `jitterFraction: 0.2` (20% random jitter). The field exists on the `RetryPolicy` type but is currently unused in the default policies. See follow-up bean for implementation.

### Dead-letter queue (DLQ)

Jobs that exhaust all retries enter `dead-letter` status. DLQ retention is **30 days**, after which jobs are auto-purged. Admin endpoints allow inspection and replay of dead-letter jobs.

### Client-side retry guidance

| Scenario                | Strategy                                                               |
| ----------------------- | ---------------------------------------------------------------------- |
| `429 Too Many Requests` | Honor `Retry-After` header exactly                                     |
| `5xx` / network error   | Exponential backoff: 1 s base, 2x multiplier, 60 s cap, 3 attempts max |
| `409 Conflict`          | Never retry blindly — re-fetch state, resolve conflict, then retry     |
| `4xx` (other)           | Do not retry — fix the request                                         |

---

## 5. Session Timeouts

| Session Type    | Absolute TTL             | Idle Timeout | Notes                       |
| --------------- | ------------------------ | ------------ | --------------------------- |
| Web             | 30 days                  | 7 days       | Standard browser sessions   |
| Mobile          | 90 days                  | 30 days      | Long-lived mobile sessions  |
| API key         | Until revoked or expired | None         | Expiry set at creation time |
| Device transfer | 5 minutes                | N/A          | Single-use, short-lived     |

### Idle timeout mechanics

The `lastActive` timestamp is updated only when the previous value is more than **60 seconds** stale. This throttling prevents write amplification from frequent API calls while maintaining reasonable idle detection.

### Key lock vs. session timeout

Session timeout governs server-side access token validity. **Key lock timeout** is a separate client-side mechanism controlling how long decrypted key material stays in memory (configured per crypto presets in client settings). These are independent — a session can be valid while keys are locked, requiring the user to re-enter their passphrase without re-authenticating.

---

## 6. Media Upload Quotas

### System storage quota

**Default:** 1 GiB (1,073,741,824 bytes) per system. Defined in `packages/storage/src/quota/quota-config.ts`. Self-hosted operators can override per-system.

### Per-purpose file size limits

| Purpose             | Max Per-File | Rationale                               |
| ------------------- | ------------ | --------------------------------------- |
| `avatar`            | 5 MiB        | Single image, client-side crop enforced |
| `member-photo`      | 10 MiB       | Gallery images                          |
| `journal-image`     | 10 MiB       | Inline journal images                   |
| `attachment`        | 25 MiB       | Documents, audio clips, etc.            |
| `export`            | 500 MiB      | Full data archives                      |
| `littles-safe-mode` | 5 MiB        | Curated safe content                    |

### Presigned URL TTLs

| Direction | TTL        | Source                                          |
| --------- | ---------- | ----------------------------------------------- |
| Upload    | 15 minutes | `packages/storage/src/adapters/s3/s3-config.ts` |
| Download  | 1 hour     | `packages/storage/src/adapters/s3/s3-config.ts` |

---

## 7. Friend Codes

| Code Type           | Default TTL | Max TTL   | Notes                            |
| ------------------- | ----------- | --------- | -------------------------------- |
| Standard (one-time) | 24 hours    | 7 days    | Single-use by default            |
| Extended            | 7 days      | 30 days   | For sharing over slower channels |
| Permanent           | No expiry   | No expiry | Revocable at any time            |

### Limits

- Maximum **10 active codes** per system at any time
- Codes are **single-use** by default (consumed on acceptance)
- Expired codes return `410 Gone` with error code `FRIEND_CODE_EXPIRED`

---

## 8. Audit Log Retention

### Hot retention

| Deployment               | Hot Retention                  | Cleanup Mechanism                                                            |
| ------------------------ | ------------------------------ | ---------------------------------------------------------------------------- |
| Hosted (PostgreSQL)      | 90 days                        | Monthly partition drop (see [ADR 017](../adr/017-audit-log-partitioning.md)) |
| Self-hosted (PostgreSQL) | Configurable (minimum 30 days) | Monthly partition drop                                                       |
| Self-hosted (SQLite)     | Configurable (minimum 30 days) | `DELETE` by timestamp cutoff                                                 |

### Webhook delivery logs

Terminal-state webhook delivery records (succeeded, failed, exhausted) are retained for **30 days**, then auto-purged.

### Data export inclusion

Audit logs are always included in data exports regardless of the hot retention window, ensuring GDPR right-of-access compliance.

### Query limits

Maximum query range per request: **90 days**. Queries spanning a longer range must be split into multiple requests.

### DLQ retention

Dead-letter job records: **30 days**, then auto-purged.
