---
# ps-afy4
title: "Milestone 3: Sync and Real-Time"
status: todo
type: milestone
priority: normal
created_at: 2026-03-08T12:15:46Z
updated_at: 2026-03-19T11:33:33Z
blocked_by:
  - ps-vtws
---

Sync implementation, WebSocket transport, offline resilience

## Completion Criteria

- All 6 implementation epics (api-fh4u, sync-qxxo, sync-p1uq, sync-hji0, api-n8wk, crypto-og5h) completed
- All api-765x audit hardening tasks completed (gates milestone)
- E2E tests passing for WebSocket, sync, SSE, and device transfer flows
- Sync convergence validated across two concurrent clients with offline/online transitions

## Design Artifacts

- `packages/sync/docs/protocol-messages.md` — Wire protocol, message types, authentication flow
- `packages/sync/docs/document-topology.md` — Document ID model, time-split partitioning
- `packages/sync/docs/conflict-resolution.md` — Post-merge validation, hierarchy cycles, tombstones
- `packages/sync/docs/partial-replication.md` — Subscription profiles, on-demand loading
- `packages/sync/docs/document-lifecycle.md` — Create, compact, archive, delete flows
- `packages/sync/docs/encrypted-relay-poc-report.md` — Encrypted relay PoC results (150+ tests)

## M4 Dependency

M4 (Fronting Engine) depends on sync being operational — fronting sessions must sync across devices via the CRDT layer built in this milestone.
