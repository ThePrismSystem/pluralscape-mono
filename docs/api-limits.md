# API Limits

This document lists hard caps enforced by the Pluralscape API. All limits return
an appropriate HTTP error when exceeded (typically 409 Conflict or 413 Content Too Large).

## Entity Limits

| Resource                             | Limit     | Error                        | Notes                                                                                   |
| ------------------------------------ | --------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| Custom field definitions per system  | 200       | 409 Conflict                 | Prevents unbounded schema growth. Enforced in `field-definition.service.ts`.            |
| Field values per member              | 200       | Bounded by field definitions | One value per definition; count follows the field definition cap.                       |
| Structure entity/group nesting depth | 50 levels | 409 Conflict                 | Ancestor walk cycle-detection cap. Enforced in `hierarchy.ts` via `MAX_ANCESTOR_DEPTH`. |
| Webhook configs per system           | 25        | 409 Conflict                 | Non-archived configs only. Enforced in `service.constants.ts`.                          |
| Privacy buckets per system           | 100       | 409 Conflict                 | Non-archived only. Enforced in `bucket.constants.ts`.                                   |
| Photos per member                    | 50        | 409 Conflict                 | Enforced in `member-photo.service.ts`.                                                  |
| Friend codes per account             | 10        | 409 Conflict                 | Active (non-archived) codes only. Enforced in `friend-code.constants.ts`.               |
| Active fronting sessions returned    | 200       | N/A (query cap)              | Maximum returned by the active fronting query. See `MAX_ACTIVE_SESSIONS`.               |

## Pagination

| Parameter                            | Default | Maximum |
| ------------------------------------ | ------- | ------- |
| Page size (general)                  | 25      | 100     |
| Page size (members)                  | 25      | 100     |
| Page size (blobs)                    | 25      | 100     |
| Page size (sessions)                 | 25      | 100     |
| Page size (fields)                   | 25      | 100     |
| Page size (field values)             | 50      | 200     |
| Page size (member photos)            | 25      | 50      |
| Page size (innerworld entities)      | 50      | 200     |
| Page size (innerworld regions)       | 25      | 100     |
| Maximum offset                       | —       | 10,000  |
| Cursor TTL                           | —       | 1 day   |
| Total count max rows (count queries) | —       | 100,000 |

## Request Limits

| Resource               | Limit    | Notes                                                                         |
| ---------------------- | -------- | ----------------------------------------------------------------------------- |
| Request body size      | 256 KiB  | Enforced in `middleware.constants.ts` (`BODY_SIZE_LIMIT_BYTES`).              |
| Idempotency-Key length | 64 chars | Header value capped at 64 characters. Enforced in `idempotency.constants.ts`. |

## Blob Storage

| Resource                          | Limit                     | Error                                    |
| --------------------------------- | ------------------------- | ---------------------------------------- |
| Per-blob size (avatar)            | 5 MiB                     | 413 Content Too Large                    |
| Per-blob size (littles-safe-mode) | 5 MiB                     | 413 Content Too Large                    |
| Per-blob size (member-photo)      | 10 MiB                    | 413 Content Too Large                    |
| Per-blob size (journal-image)     | 10 MiB                    | 413 Content Too Large                    |
| Per-blob size (attachment)        | 25 MiB                    | 413 Content Too Large                    |
| Per-blob size (export)            | 500 MiB                   | 413 Content Too Large                    |
| System storage quota              | Configured per deployment | 413 Content Too Large (`QUOTA_EXCEEDED`) |
| Presigned upload URL TTL          | 15 minutes                | Upload URL expires silently              |

## Encrypted Data Payloads

| Resource                        | Limit                         |
| ------------------------------- | ----------------------------- |
| Generic encrypted data          | 64 KiB (after base64 decode)  |
| System encrypted data           | 98 KiB (after base64 decode)  |
| Field definition encrypted data | 32 KiB (after base64 decode)  |
| Member encrypted data           | 128 KiB (after base64 decode) |
| Field value encrypted data      | 16 KiB (after base64 decode)  |

## Session Limits

| Resource                            | Limit     | Notes                                                                          |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------ |
| Max concurrent sessions per account | 50        | Oldest session evicted when exceeded. See `MAX_SESSIONS_PER_ACCOUNT`.          |
| Web session absolute TTL            | 30 days   | See `SESSION_TIMEOUTS.web.absoluteTtlMs`.                                      |
| Web session idle timeout            | 7 days    | See `SESSION_TIMEOUTS.web.idleTimeoutMs`.                                      |
| Mobile session absolute TTL         | 90 days   | See `SESSION_TIMEOUTS.mobile.absoluteTtlMs`.                                   |
| Mobile session idle timeout         | 30 days   | See `SESSION_TIMEOUTS.mobile.idleTimeoutMs`.                                   |
| Device transfer session TTL         | 5 minutes | No idle timeout. See `SESSION_TIMEOUTS.deviceTransfer`.                        |
| Device transfer code attempts       | 5         | Transfer expired after 5 incorrect attempts. See `MAX_TRANSFER_CODE_ATTEMPTS`. |
| Transfer initiations per window     | 3         | Per rate window. See `TRANSFER_INITIATION_LIMIT`.                              |

## WebSocket (Sync) Limits

| Resource                                 | Limit      | Window | Notes                                                       |
| ---------------------------------------- | ---------- | ------ | ----------------------------------------------------------- |
| Max concurrent connections per account   | 10         | —      | See `WS_MAX_CONNECTIONS_PER_ACCOUNT`.                       |
| Max unauthenticated connections (global) | 500        | —      | Slowloris prevention. See `WS_MAX_UNAUTHED_CONNECTIONS`.    |
| Max unauthenticated connections per IP   | 50         | —      | See `WS_MAX_UNAUTHED_CONNECTIONS_PER_IP`.                   |
| Max message size                         | 5 MiB      | —      | See `WS_MAX_MESSAGE_BYTES`.                                 |
| Auth timeout                             | 10 s       | —      | Connection closed if AuthenticateRequest not received.      |
| Idle timeout                             | 60 s       | —      | Bun closes connection after 60 s of inactivity.             |
| Mutation rate limit                      | 100 msgs   | 10 s   | SubmitChange, SubmitSnapshot. See `WS_MUTATION_RATE_LIMIT`. |
| Read rate limit                          | 200 msgs   | 10 s   | Fetch*, Manifest* messages. See `WS_READ_RATE_LIMIT`.       |
| Rate limit strikes before disconnect     | 10         | —      | See `WS_RATE_LIMIT_STRIKE_MAX`.                             |
| Max documents per SubscribeRequest       | 100        | —      | See `WS_MAX_SUBSCRIBE_DOCUMENTS`.                           |
| Max subscriptions per connection         | 500        | —      | See `WS_MAX_SUBSCRIPTIONS_PER_CONNECTION`.                  |
| Envelope page size (getEnvelopesSince)   | 500        | —      | See `WS_ENVELOPE_PAGE_SIZE`.                                |
| Relay in-memory document cache           | 1,000 docs | —      | LRU eviction after limit. See `WS_RELAY_MAX_DOCUMENTS`.     |

## SSE (Notification Stream) Limits

| Resource                                   | Limit      | Notes                                              |
| ------------------------------------------ | ---------- | -------------------------------------------------- |
| Max concurrent SSE connections per account | 5          | See `SSE_MAX_CONNECTIONS_PER_ACCOUNT`.             |
| Replay buffer size                         | 100 events | Events retained for replay on reconnect.           |
| Replay max event age                       | 5 minutes  | Events older than 5 min not replayed on reconnect. |

## Webhook Limits

| Resource                           | Limit | Notes                                                                      |
| ---------------------------------- | ----- | -------------------------------------------------------------------------- |
| Max concurrent deliveries per host | 5     | Prevents hammering a single target. See `WEBHOOK_PER_HOST_MAX_CONCURRENT`. |
| Max retry attempts per delivery    | 5     | Exponential backoff with jitter. See `WEBHOOK_MAX_RETRY_ATTEMPTS`.         |
| Delivery timeout                   | 10 s  | See `WEBHOOK_DELIVERY_TIMEOUT_MS`.                                         |

## Data Retention

| Resource                      | Retention | Notes                                                              |
| ----------------------------- | --------- | ------------------------------------------------------------------ |
| Webhook deliveries (terminal) | 30 days   | Auto-purged by cleanup job after success/fail                      |
| Dead-letter queue entries     | 30 days   | See `AUDIT_RETENTION.dlqRetentionDays`.                            |
| Audit log (hosted, hot tier)  | 90 days   | See `AUDIT_RETENTION.hostedHotRetentionDays`.                      |
| Audit log (self-hosted, min)  | 30 days   | See `AUDIT_RETENTION.selfHostedMinRetentionDays`.                  |
| Audit log query range         | 90 days   | Max time range per query. See `AUDIT_RETENTION.maxQueryRangeDays`. |

## Rate Limits

| Category               | Limit       | Window     |
| ---------------------- | ----------- | ---------- | ---------------------------------------------------------------- |
| Global                 | 100 req     | 60s        |
| Auth (heavy)           | 5 req       | 60s        |
| Auth (light)           | 20 req      | 60s        |
| Device transfer        | 10 req      | 60s        |
| Write operations       | 60 req      | 60s        |
| Read (default)         | 60 req      | 60s        |
| Read (heavy)           | 30 req      | 60s        |
| Blob upload            | 20 req      | 60s        |
| Webhook management     | 20 req      | 60s        |
| Data export            | 2 req       | 3600s      |
| Data import            | 2 req       | 3600s      |
| Account purge          | 1 req       | 86400s     |
| Audit query            | 30 req      | 60s        |
| Friend code (generate) | 10 req      | 60s        |
| Friend code (redeem)   | 5 req       | 60s        |
| Public API             | 60 req      | 60s        |
| SSE stream             | 5 req       | 60s        |
| Login (per account)    | 10 attempts | per window | Tracked separately from rate limits; triggers `LOGIN_THROTTLED`. |

Rate limits are applied per-category via middleware. See `packages/types/src/api-constants.ts` for authoritative values.
