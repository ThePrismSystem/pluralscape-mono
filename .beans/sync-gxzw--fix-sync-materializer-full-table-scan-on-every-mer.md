---
# sync-gxzw
title: Fix sync materializer full-table scan on every merge
status: completed
type: task
priority: high
created_at: 2026-04-14T09:29:25Z
updated_at: 2026-04-14T10:26:32Z
---

AUDIT [SYNC-P-H1] materializeDocument calls SELECT \* for every entity type on every incoming change. No filtering by document ID or changed field. Full scan on every sync event for large tables (messages, fronting sessions). File: materializer/materializers/materialize-document.ts:36

## Summary of Changes

Scoped materializer queries to changed entity types instead of full-table scan.
