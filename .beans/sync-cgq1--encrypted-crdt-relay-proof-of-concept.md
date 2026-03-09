---
# sync-cgq1
title: Encrypted CRDT relay proof-of-concept
status: completed
type: task
priority: critical
created_at: 2026-03-09T12:13:02Z
updated_at: 2026-03-09T21:16:26Z
parent: sync-mxeg
blocking:
  - ps-rdqo
---

Build a minimal PoC: two Automerge clients syncing a single encrypted Member profile through a dumb relay server. Prove: (1) Automerge sync messages work when payload is encrypted, (2) server cannot read content, (3) conflict resolution works correctly after concurrent edits. This validates the entire sync architecture before committing to it.

Source: Architecture Audit 004, Fix This Now #1

## Summary of Changes

Implemented encrypted CRDT relay proof-of-concept in `packages/sync/src/`:

**Files created:**

- `types.ts` — DocumentKeys, EncryptedChangeEnvelope, EncryptedSnapshotEnvelope, MemberProfile
- `encrypted-sync.ts` — encryptChange, decryptChange, encryptSnapshot, decryptSnapshot, verifyEnvelopeSignature
- `relay.ts` — EncryptedRelay (in-memory append-only ciphertext log)
- `sync-session.ts` — EncryptedSyncSession (Automerge doc + encryption), syncThroughRelay
- `index.ts` — re-exports public API

**24 tests across 3 test files proving all 3 goals:**

- Goal 1 (encrypted sync works): tests 3.1, 3.2
- Goal 2 (zero-knowledge relay): tests 1.1, 2.3
- Goal 3 (conflict resolution): tests 3.3, 3.4, 3.5, 3.9
- Bonus: replay idempotency (3.6), snapshot bootstrap (3.7, 3.8)

**Key design decision:** Uses Automerge changes (not sync messages) for relay distribution, matching secsync's architecture. All clients share a common document origin via cloning.
