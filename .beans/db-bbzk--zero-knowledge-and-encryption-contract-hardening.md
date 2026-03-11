---
# db-bbzk
title: Zero-knowledge and encryption contract hardening
status: completed
type: feature
priority: normal
created_at: 2026-03-11T19:39:26Z
updated_at: 2026-03-11T22:31:59Z
parent: db-2je4
---

Consolidate remaining ZK violations and encryption contract gaps that break the core E2E promise. Without this, the server can read user content it shouldn't.

## Consolidates

db-e5qm, db-fymu, db-sng6, db-kveq, db-0d2a, db-5hkc

## Tasks

- [ ] Move remaining sensitive plaintext metadata into encryptedData (db-e5qm)
- [ ] Fix messages.sender_id zero-knowledge violation (db-fymu)
- [ ] Fix deviceTokens.token plaintext vs encrypted contract (db-sng6)
- [ ] Document or fix nonce storage for encryptedData blobs (db-kveq)
- [ ] Add keyVersion to content table encryptedData blobs (db-0d2a)
- [ ] Application-layer encryption round-trip tests (db-5hkc)

## Summary of Changes

Completed all 5 phases of zero-knowledge encryption contract hardening:

1. Removed senderId from messages/boardMessages (db-fymu)
2. Moved sensitive plaintext metadata into encrypted tier (db-e5qm)
3. Aligned deviceTokens contract with T3 tier (db-sng6)
4. Documented nonce/keyVersion storage in blob wire format (db-kveq, db-0d2a)
5. Scaffolded entity encryption round-trip tests (db-5hkc)

37 files changed, 135 insertions, 515 deletions. All tests pass (1148 across 73 files).
