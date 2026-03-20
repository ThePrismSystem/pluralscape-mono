---
# sync-ix0u
title: WebSocket network adapter
status: completed
type: task
priority: high
created_at: 2026-03-19T11:39:41Z
updated_at: 2026-03-20T01:23:14Z
parent: sync-qxxo
---

Implement \`SyncNetworkAdapter\` over WebSocket using \`SyncTransport\` from the protocol spec.

## Acceptance Criteria

- Passes all contract tests in \`packages/sync/src/**tests**/network-adapter.contract.ts\`
- Subscribe/unsubscribe lifecycle maps to WebSocket SubscribeRequest/UnsubscribeRequest
- Reconnection retains last seq per document (resumes from correct position)
- Disconnect triggers adapter state change (callers can detect offline)
- Submit and receive change envelopes via WebSocket message framing

## Summary of Changes

- Created WsNetworkAdapter mapping SyncNetworkAdapter methods to WebSocket protocol messages
- Implemented correlation-ID-based request/response matching with timeout
- Implemented subscription callbacks for DocumentUpdate pushes
- Created MockSyncTransport for testing (in-memory relay-backed)
- Passes all network adapter contract tests (12 tests)
