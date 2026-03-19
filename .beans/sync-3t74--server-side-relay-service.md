---
# sync-3t74
title: Server-side relay service
status: todo
type: task
priority: critical
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
parent: sync-qxxo
---

Store encrypted change envelopes and snapshots in sync tables. Implement: submitChange, fetchChangesSince, submitSnapshot, fetchLatestSnapshot, fetchManifest.

## Acceptance Criteria

- Submit/fetch roundtrip: submit a change envelope, fetch it back with correct payload
- Snapshot version enforcement: snapshot only accepted if version >= current
- Manifest generation: returns list of documents with latest seq per doc
- Duplicate dedup by (docId, authorPublicKey, nonce) — resubmit returns success without double-storing
- All payloads stored as opaque encrypted blobs (server never decrypts)
- Integration tests against real PostgreSQL
