---
# db-b5i4
title: Add RLS to sync_changes, sync_snapshots, sync_conflicts
status: completed
type: bug
priority: high
created_at: 2026-04-14T09:28:40Z
updated_at: 2026-04-16T06:35:33Z
parent: ps-ai5y
---

AUDIT [DB-S-H1] These tables hold encrypted sync payloads but lack ENABLE ROW LEVEL SECURITY. Direct scan bypasses all isolation. RLS on sync_documents alone does not restrict reads on children.

## Summary of Changes

Added `system-fk` RLS scope type with FK-based subquery isolation. sync_changes, sync_snapshots, and sync_conflicts now have RLS policies that join through sync_documents.system_id. Added `systemFkRlsPolicy` generator, `SYSTEM_FK_MAPPING` constant, and comprehensive integration tests verifying cross-tenant isolation on all three tables. Added sync_conflicts to pg-helpers DDL and createPgSyncTables/createPgAllTables.
