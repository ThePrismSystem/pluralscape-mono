---
# db-0d2a
title: Add keyVersion to content table encryptedData blobs
status: completed
type: bug
priority: high
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-11T22:31:50Z
parent: db-bbzk
---

ADR 014 requires blobs to record which keyVersion they were encrypted with for dual-key read window. keyVersion exists only on key_grants, not on members, journal_entries, messages, etc. Lazy rotation protocol cannot work without this. Ref: audit H7

## Summary of Changes

Already solved by blob-codec wire format — EncryptedBlob.keyVersion is serialized into every pgEncryptedBlob/sqliteEncryptedBlob column. No separate column needed. Added documentation and keyVersion round-trip tests.
