---
# sync-qxxo
title: CRDT sync implementation
status: completed
type: epic
priority: critical
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-20T09:56:16Z
parent: ps-afy4
blocking:
  - sync-p1uq
  - sync-hji0
blocked_by:
  - sync-cgq1
  - api-fh4u
---

packages/sync — Automerge integration, encrypted sync payloads

## Scope

Server-side relay service and client-side sync engine. Implements encrypted change envelope storage, the document-ID model from the topology spec, SQLite and WebSocket adapters, initial sync bootstrap, steady-state sync cycle, and compaction job.

Blocked by api-fh4u (WebSocket server) — the network adapter requires a working WebSocket transport.

## Acceptance Criteria

- Server relay stores/retrieves encrypted change envelopes and snapshots
- Sync schema matches document-ID model (e.g., `fronting-sys_abc-2026-Q1`)
- SQLite storage adapter passes contract tests
- WebSocket network adapter passes contract tests with reconnection
- Client bootstraps from empty state via manifest → subscribe → catchup
- Two concurrent clients converge after offline edits
- Compaction job creates snapshots at threshold and prunes old changes

## Design References

- `packages/sync/docs/protocol-messages.md` — Submit/fetch protocol
- `packages/sync/docs/document-topology.md` — Document ID model, time-split partitioning
- `packages/sync/docs/document-lifecycle.md` — Create, compact, archive, delete
- `packages/sync/docs/encrypted-relay-poc-report.md` — PoC validation results
- `packages/sync/src/adapters/` — Existing adapter interfaces

## Summary of Changes\n\nAll 8 child tasks completed: server-side relay service, SQLite storage adapter, WebSocket network adapter, client sync engine (initial sync + steady-state cycle), compaction job, sync schema audit, and PR review fixes. Full CRDT sync infrastructure is operational.
