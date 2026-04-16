---
# sync-qj9u
title: Implement sync conflict persistence with E2E encryption
status: todo
type: feature
priority: critical
created_at: 2026-04-16T03:05:40Z
updated_at: 2026-04-16T03:05:40Z
---

The `sync_conflicts` table exists in the PG schema with RLS policies, but no concrete `ConflictPersistenceAdapter` implementation writes to it. Only an in-memory test adapter exists.

The sync engine (client-side in `packages/sync`) detects conflicts during Automerge merges and generates `ConflictNotification` objects with human-readable summaries via `post-merge-validator.ts`. These summaries contain entity IDs and structural values (e.g., "Cycle broken: nulled parent of ${entityId}").

## Requirements

- [ ] Implement a concrete `ConflictPersistenceAdapter` that persists conflicts to the server via tRPC endpoint
- [ ] The `summary` field MUST be encrypted client-side with the bucket key before sending to the server — the server must never see plaintext conflict summaries
- [ ] Store the summary inside `encryptedPayload` (which already uses `pgBinary` for T2 encrypted data) rather than the plaintext `summary` varchar column
- [ ] The plaintext `summary` column on `sync_conflicts` should either be removed or repurposed as a structural-only field (resolution type + entity count, no content)
- [ ] Ensure the conflict persistence path does not slow down the sync hot path (best-effort, non-blocking)
- [ ] Add integration tests verifying conflicts are persisted and retrievable (client decrypts summary)

## Context

- `packages/sync/src/conflict-persistence.ts` — adapter interface
- `packages/sync/src/engine/sync-engine.ts:539-563` — `persistConflicts()` method
- `packages/sync/src/post-merge-validator.ts` — generates conflict summaries
- `packages/db/src/schema/pg/sync.ts` — `sync_conflicts` table schema
- Zero-knowledge audit (2026-04-15) finding M1: sync conflict summary may contain entity names/field details
