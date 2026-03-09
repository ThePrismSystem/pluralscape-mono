---
# crypto-gkaa
title: Design lazy key rotation protocol for privacy buckets
status: completed
type: task
priority: critical
created_at: 2026-03-09T12:13:12Z
updated_at: 2026-03-09T12:40:49Z
parent: crypto-gd8f
---

Write an ADR for bucket key rotation that specifies: rotation state machine (pending/in-progress/completed), background worker protocol, client behavior when encountering stale-key ciphertext during rotation window, concurrent rotation serialization, maximum acceptable window between revocation and rotation completion. Currently O(bucket_size) with no lazy design.

Source: Architecture Audit 004, Fix This Now #2

## Summary of Changes

- Created ADR 014 (`docs/adr/014-lazy-key-rotation.md`) specifying the lazy key rotation protocol
- Protocol splits revocation (immediate, <2s) from re-encryption (deferred, client-driven)
- Defines rotation state machine: initiated → migrating → sealing → completed/failed
- Server-side rotation ledger (T3 metadata) with chunk-based claim mechanism for concurrent device re-encryption
- Dual-key read window using `EncryptedBlob.keyVersion` for seamless reads during migration
- Concurrent rotation serialization (max 1 active per bucket, batching for rapid removals)
- 7-day hard limit with fail-safe (old key preserved on timeout)
- Updated ADR 006 consequence to cross-reference ADR 014
