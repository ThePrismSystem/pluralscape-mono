---
# sync-cqbo
title: "Relay hardening: prune dedup on snapshot, optimize dedup keys, cap snapshot size, implement SyncRelayService directly"
status: completed
type: task
priority: normal
created_at: 2026-03-21T03:51:53Z
updated_at: 2026-03-21T03:51:56Z
parent: ps-irrf
---

## Summary of Changes

Implements 4 findings from M3 comprehensive audit:

**P-H3**: Added `pruneDedupForDocument(docId, upToSeq)` private method to `EncryptedRelay`. Called from `submitSnapshot` to prune dedup entries for changes with seq <= snapshotVersion. This frees memory for changes subsumed by the snapshot.

**P-M6**: Replaced hex-based dedup key generation with a concatenated buffer approach. The new `buildDedupKey` copies authorPublicKey (32B) + nonce (24B) into a single Uint8Array and base64-encodes it, avoiding the per-byte hex loop and producing shorter keys.

**Sec-M3**: Changed `RELAY_MAX_SNAPSHOT_SIZE_BYTES` from `Infinity` to `50 * MiB`, preventing memory exhaustion from oversized snapshot blobs.

**S-M2**: Made `EncryptedRelay` implement `SyncRelayService` directly. All methods now return Promises (using `Promise.resolve/reject` to avoid async-without-await lint). The `asService()` method is kept as a thin identity shim returning `this` for call-site compatibility while callers migrate. Added `PaginatedEnvelopes` type and paginated `getEnvelopesSince(docId, sinceSeq, limit?)` signature matching PR #225.
