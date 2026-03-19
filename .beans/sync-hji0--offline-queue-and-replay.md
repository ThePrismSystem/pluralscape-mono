---
# sync-hji0
title: Offline queue and replay
status: todo
type: epic
priority: high
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-19T11:40:27Z
parent: ps-afy4
blocked_by:
  - sync-qxxo
---

Cryptographic confirmation before clearing local

## Scope

Offline queue that persists encrypted change envelopes when the transport is disconnected, replays them in order on reconnect, and only marks them as synced after receiving cryptographic confirmation (ChangeAccepted with server-assigned seq). Includes queue cleanup job.

Blocked by sync-qxxo (CRDT sync) — the offline queue wraps the sync engine's submit path.

## Acceptance Criteria

- Changes accumulate in sync_queue when transport disconnected (syncedAt = null)
- Queue survives app restart, ordered by seq per system
- Replay drains queue in seq order on reconnect
- No syncedAt until ChangeAccepted received; connection drop triggers re-submission
- Server dedup prevents double-apply of replayed changes
- Exponential backoff for RATE_LIMITED/INTERNAL_ERROR responses
- Queue cleanup job removes confirmed rows past retention window
- E2E tests: offline submit → reconnect → changes arrive

## Design References

- `packages/sync/docs/protocol-messages.md` — ChangeAccepted, SubmitChangeRequest
- `packages/sync/docs/document-lifecycle.md` — Queue and confirmation semantics
