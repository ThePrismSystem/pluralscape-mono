---
# sync-mgcd
title: Partial replication strategy
status: completed
type: task
priority: normal
created_at: 2026-03-08T13:35:33Z
updated_at: 2026-03-15T01:04:55Z
parent: sync-xlhb
---

Design document: which CRDT documents each client subscribes to. Output is a specification, not code.

## Scope

- Subscription rules by client type:
  - System owner: full replication of all own documents
  - Friend dashboard: subscribe to bucket-scoped fronting docs only (filtered by key grants)
  - Multi-device: full replication across owner's devices
- Document metadata for subscription filtering (doc type, system_id, bucket_id)
- Bandwidth optimization: sync only changed documents (delta sync)
- Initial sync: full document download for new devices
- Incremental sync: binary patches for subsequent syncs
- Document discovery: how a client learns which documents exist

## Acceptance Criteria

- [ ] Subscription rules documented per client type
- [ ] Document metadata schema for filtering
- [ ] Delta sync strategy specified
- [ ] Initial vs incremental sync differentiated
- [ ] Document discovery mechanism defined
- [ ] Written as specification in packages/sync/docs/

## References

- ADR 005

## Summary of Changes

- Created packages/sync/docs/partial-replication.md: 10 sections covering client profiles (owner-full/lite/friend), subscription filtering algorithm (pure function, server-side for friends), document discovery/manifest lifecycle, initial sync, incremental sync, priority ordering, friend subscription lifecycle (grant/revoke/new-grant), on-demand loading, and edge cases
- Created packages/sync/src/replication-profiles.ts: ReplicationProfileType, OwnerFullProfile, OwnerLiteConfig, FriendProfileConfig, ReplicationProfile, DocumentSyncState, SubscriptionSet, DocumentLoadRequest, DEFAULT_OWNER_FULL_PROFILE, DEFAULT_OWNER_LITE_CONFIG
- Updated packages/sync/src/index.ts: re-exports all replication-profiles types
