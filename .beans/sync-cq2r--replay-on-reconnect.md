---
# sync-cq2r
title: Replay on reconnect
status: todo
type: task
priority: high
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
parent: sync-hji0
---

Drain offline queue in seq order on AuthenticateResponse (reconnect). Mark syncedAt on server confirmation. Exponential backoff for RATE_LIMITED/INTERNAL_ERROR.

## Acceptance Criteria

- N offline changes replayed in correct seq order on reconnect
- No double-submission: server dedup by (docId, authorPublicKey, nonce) prevents duplicate apply
- RATE_LIMITED response triggers exponential backoff before retry
- INTERNAL_ERROR response triggers exponential backoff before retry
- Replay progress tracked (partial replay resumable after disconnect)
- Integration test: enqueue N changes offline, reconnect, verify all arrive at relay
