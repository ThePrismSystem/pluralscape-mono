---
# sync-mgcd
title: Partial replication strategy
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:35:33Z
updated_at: 2026-03-08T13:35:41Z
parent: sync-xlhb
---

Define which CRDT documents each client subscribes to

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
