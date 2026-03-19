---
# sync-ieg2
title: "Client sync engine: initial sync"
status: todo
type: task
priority: high
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
parent: sync-qxxo
---

Implement initial sync flow: Authenticate → ManifestRequest → SubscribeRequest → apply catchup. Uses OnDemandLoader for non-subscribed docs.

## Acceptance Criteria

- Fresh client bootstraps all docs from a populated relay server
- Snapshot bootstrap path: if server has snapshot, client loads snapshot first then changes
- ManifestRequest returns document list; client subscribes to profile-relevant docs
- Non-subscribed docs available via OnDemandLoader (lazy fetch on access)
- Bootstrap completes without errors for empty server (no docs)
- Integration test: populate relay, bootstrap new client, verify local state matches
