# ADR 010: Background Job Architecture — BullMQ with SQLite Fallback

## Status

Accepted

## Context

Several Pluralscape features require asynchronous, retryable, long-running processing that cannot block API request/response cycles:

- SP/PK data imports (parsing large JSON exports, encrypting and storing hundreds of records)
- HTML/PDF report generation (fronting history, member reports, "meet our system" reports)
- Webhook delivery with retry and backoff
- Push notification fan-out (one switch event → notifications to N friends)
- Full account purge (GDPR-compliant deletion across all storage backends)
- Privacy bucket key rotation (re-encrypt all objects in a bucket when a friend is removed)

Requirements:

- Reliable delivery — jobs must not be silently dropped
- Retry with exponential backoff and dead-letter queue (DLQ) for failed jobs
- Idempotency — jobs can be safely retried without duplicate side effects
- Self-hosting without mandatory external services
- Observability — job status, failure reasons, queue depth

Evaluated: BullMQ, pg-boss, Temporal, custom SQLite queue, in-process setTimeout chains.

## Decision

**BullMQ** (backed by Valkey) for the hosted service and full self-hosted tier. **SQLite-backed in-process queue** for the minimal self-hosted tier.

### Hosted / Full self-hosted (BullMQ + Valkey)

- BullMQ provides: priority queues, delayed jobs, rate limiting, retry with configurable backoff, DLQ, job events, repeatable jobs (for scheduled tasks like timer check-ins)
- Valkey is already in the stack for real-time pub/sub (ADR 007) — no new infrastructure
- Workers run in the same Bun process (single-process deployment) or as separate worker processes for horizontal scaling
- Job payloads contain only references (IDs, keys) — never plaintext user data

### Minimal self-hosted (SQLite queue)

- Simple job table in the existing SQLite database: `id`, `type`, `payload`, `status`, `attempts`, `next_retry_at`, `created_at`
- Single in-process worker polls the table on a configurable interval
- Same retry/backoff/DLQ semantics, just lower throughput
- No additional dependencies — works with the single-binary deployment

### Job design principles

- **Idempotency keys** — every job carries a unique idempotency key. Workers check for prior completion before executing.
- **Encrypted payloads** — job payloads that reference user data contain encrypted references or IDs only. Workers that need plaintext (e.g., webhook delivery) operate on tier 3 metadata only.
- **Timeout and heartbeat** — long-running jobs (imports, key rotation) emit heartbeats. Jobs that exceed their timeout are marked failed and retried.
- **Observability** — job status queryable via internal API. Failed jobs with DLQ entries generate admin alerts.

### Why not alternatives

- **pg-boss**: PostgreSQL-only, does not work with SQLite self-hosted tier
- **Temporal**: Heavyweight workflow engine, massive operational complexity for a small team
- **Custom only**: Reinventing retry, backoff, DLQ, and rate limiting is error-prone

## Consequences

- Valkey becomes a harder dependency for the full deployment (already required for real-time — ADR 007)
- SQLite queue has lower throughput and no horizontal scaling — acceptable for personal/small-group self-hosted use
- Job payloads must be carefully designed to avoid leaking plaintext data
- Two queue backends (BullMQ + SQLite) require a shared interface/adapter pattern and testing against both
- BullMQ's Node.js/Bun compatibility should be verified — BullMQ uses ioredis under the hood, which works with Valkey

### License

BullMQ: MIT (compatible). ioredis: MIT (compatible).
