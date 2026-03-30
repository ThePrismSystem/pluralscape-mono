---
# api-5xl6
title: Wire Valkey pub/sub for cross-instance sync broadcast
status: todo
type: task
priority: high
created_at: 2026-03-30T06:58:13Z
updated_at: 2026-03-30T06:58:13Z
parent: api-e7gt
---

ValkeyPubSub class exists in apps/api/src/ws/valkey-pubsub.ts but broadcastDocumentUpdate() only does local delivery (comment: 'Local delivery only in Phase 1'). Wire Valkey pub/sub into the broadcast path so multi-instance deployments can fan out sync updates across instances.
