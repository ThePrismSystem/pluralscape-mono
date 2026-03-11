---
# db-bbzk
title: Zero-knowledge and encryption contract hardening
status: todo
type: feature
created_at: 2026-03-11T19:39:26Z
updated_at: 2026-03-11T19:39:26Z
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
