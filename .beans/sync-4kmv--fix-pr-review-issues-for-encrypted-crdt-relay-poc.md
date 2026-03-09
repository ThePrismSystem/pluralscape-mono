---
# sync-4kmv
title: Fix PR review issues for encrypted CRDT relay POC
status: completed
type: task
priority: high
created_at: 2026-03-09T21:39:32Z
updated_at: 2026-03-09T21:40:01Z
---

Address 2 critical, 5 important, and 8 suggestion-level issues from PR review of feat/encrypted-crdt-relay-poc. Key fixes: TextEncoder for AEAD associated data (was silently truncating non-ASCII), atomic rollback in applyEncryptedChanges, snapshot version monotonicity, defensive copy in inspectStorage, MemberProfile moved to test-local, re-exports removed.

## Summary of Changes

### Critical fixes

- **stringToBytes → TextEncoder**: Replaced manual byte-masking (which silently truncated non-ASCII) with `TextEncoder.encode()` for AEAD associated data binding
- **Atomic rollback**: `applyEncryptedChanges` now saves doc/seq state before processing and restores on error

### Important fixes

- **Snapshot version monotonicity**: `submitSnapshot` rejects versions ≤ current
- **Defensive copy**: `inspectStorage` returns `[...envelopes]` instead of mutable reference
- **Sorted envelopes**: `applyEncryptedChanges` sorts by seq before processing
- **fromSnapshot seq param**: Accepts optional `lastSyncedSeq` parameter
- **Renamed field**: `lastSeenSeq` → `lastSyncedSeq_` (private backing field)

### Cleanup

- Removed `MemberProfile` from public API (moved to test-local interface)
- Used `SignKeypair` type instead of inline object type in `DocumentKeys`
- Removed re-exports from types.ts
- Added `ErrorOptions` support to `SignatureVerificationError`
- Inlined `buildChangeAD` (was just `encoder.encode(documentId)`)
- Simplified `syncThroughRelay` to single pass (while loop unnecessary)
- Added `TextEncoder`/`TextDecoder` to global ambient types

### New tests (28 total, up from 24)

- 1.10: decryptSnapshot throws on tampered ciphertext
- 1.11: decryptSnapshot throws with wrong key
- 3.6: rewritten to test encrypted idempotency via seq-skip
- 3.10: mid-batch decryption failure rolls back doc and seq
- 3.11: relay rejects snapshot version downgrade/equal
