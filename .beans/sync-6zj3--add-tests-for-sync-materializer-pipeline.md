---
# sync-6zj3
title: Add tests for sync materializer pipeline
status: completed
type: task
priority: high
created_at: 2026-04-14T09:29:13Z
updated_at: 2026-04-16T06:35:33Z
parent: ps-ai5y
---

AUDIT [SYNC-TC-H1..H4] entity-registry.ts (825 lines), base-materializer.ts diff/apply logic, ws-client-adapter.ts reconnect/auth, full materializer pipeline all have zero test coverage. These are core sync components.

## Summary of Changes

Added comprehensive test coverage for all four sync materializer pipeline components:

- **entity-registry.test.ts** (197 lines): registry completeness, column validation, FTS column references, getTableDef lookup, hot-path flags, nullable columns, primary key constraints, getEntityTypesForDocument for all document types, materializer registration, DDL generation
- **base-materializer.test.ts** (361 lines): diffEntities (inserts/deletes/updates/identical/mixed), toSnakeCase conversion, entityToRow (simple/array/object/column filtering), applyDiff (empty skip/INSERT OR REPLACE/DELETE/transactions/cold-path no events/hot-path entity events for create/update/delete)
- **ws-client-adapter.test.ts** (1043 lines): auth handshake (send/timeout/mismatch/success), disconnect (close/disconnect/close alias), notification demux, DocumentUpdate routing (subscribe/unsubscribe/resilience), request/response correlation, error emission (subscriber errors/malformed messages), submitChange/fetchChangesSince/submitSnapshot/fetchLatestSnapshot, edge cases (empty changes/null ws/disposed state/sendRaw guard/AUTH_FAILED/PROTOCOL_MISMATCH/unknown correlation/onopen guard/onmessage guard)
- **Pipeline integration** covered by materialize-document.test.ts (265 lines) and system-core.test.ts (257 lines): end-to-end document materialization, entity extraction, diff against SQLite state, event emission, singleton/junction/map entity types
