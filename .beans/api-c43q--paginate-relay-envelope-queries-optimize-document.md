---
# api-c43q
title: Paginate relay envelope queries, optimize document load, verify envelope signatures
status: completed
type: task
priority: normal
created_at: 2026-03-21T03:26:07Z
updated_at: 2026-03-21T03:45:54Z
parent: ps-irrf
---

## Summary of Changes

Implements three M3 audit findings for WS handlers and relay DB service:

**P-H1: Paginate envelope queries**

- Added `PaginatedEnvelopes` type with `envelopes` and `hasMore` fields to `SyncRelayService` interface
- `getEnvelopesSince` now accepts an optional `limit` parameter (default 500)
- `PgSyncRelayService` fetches `limit + 1` rows to detect `hasMore` without a count query
- `EncryptedRelay.asService()` wrapper applies pagination in-memory
- All callers updated: `handleFetchChanges`, `handleSubscribeRequest`, `handleDocumentLoad`

**P-H2: Optimize document load**

- `handleDocumentLoad` now fetches the snapshot first, then fetches only changes since the snapshot version
- When no snapshot exists, falls back to paginated fetch from seq 0
- Eliminates loading the full change history when a snapshot covers most of it

**Sec-M2: Server-side envelope signature verification**

- `handleSubmitChange` verifies envelope signatures using `verifyEnvelopeSignature()` before storing/broadcasting
- On verification failure, returns `INVALID_ENVELOPE` SyncError and drops the envelope
- Configurable via `VERIFY_ENVELOPE_SIGNATURES` env var (defaults to `true` for secure-by-default)
- Added `INVALID_ENVELOPE` to `SyncErrorCode` union
- Message router updated to handle the new error return path
