---
# sync-ix0u
title: WebSocket network adapter
status: todo
type: task
priority: high
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-19T11:39:41Z
parent: sync-qxxo
---

Implement \`SyncNetworkAdapter\` over WebSocket using \`SyncTransport\` from the protocol spec.

## Acceptance Criteria

- Passes all contract tests in \`packages/sync/src/**tests**/network-adapter.contract.ts\`
- Subscribe/unsubscribe lifecycle maps to WebSocket SubscribeRequest/UnsubscribeRequest
- Reconnection retains last seq per document (resumes from correct position)
- Disconnect triggers adapter state change (callers can detect offline)
- Submit and receive change envelopes via WebSocket message framing
