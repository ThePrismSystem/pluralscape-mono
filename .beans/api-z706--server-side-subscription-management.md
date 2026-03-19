---
# api-z706
title: Server-side subscription management
status: completed
type: task
priority: high
created_at: 2026-03-19T11:39:40Z
updated_at: 2026-03-19T14:18:06Z
parent: api-fh4u
---

Handle SubscribeRequest: compute catch-up data (changes since client's last seq), send SubscribeResponse with catch-up payload, register subscription in connection state. Handle UnsubscribeRequest.

## Acceptance Criteria

- Fresh client (seq=0) receives all changes for document in catch-up
- Current client receives empty catch-up payload
- Subscription registered in connection state after successful subscribe
- UnsubscribeRequest removes subscription, stops push delivery for that doc
- Subscribing to already-subscribed doc is idempotent (no duplicate pushes)
- Unit tests for catch-up computation and subscription lifecycle

## Summary of Changes

Implemented server-side subscription management and broadcast:

- Created `broadcast.ts` with `broadcastDocumentUpdate()` for local fan-out
- Broadcasts to all subscribers except the submitter (no self-echo)
- Tolerates send failures on individual connections without affecting others
- Wired broadcast into SubmitChangeRequest handler in the message router
- 5 unit tests covering subscriber delivery, exclusion, auth checks, fault tolerance
