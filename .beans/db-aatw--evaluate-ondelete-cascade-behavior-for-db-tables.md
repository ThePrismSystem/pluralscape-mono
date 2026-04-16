---
# db-aatw
title: Evaluate onDelete cascade behavior for DB tables
status: completed
type: task
priority: normal
created_at: 2026-03-17T01:31:16Z
updated_at: 2026-04-16T07:29:44Z
parent: ps-rdqo
---

Audit all onDelete configurations across DB tables to verify cascade/restrict/set-null behavior matches intended data lifecycle. Ensure hard deletes, soft deletes, and archive patterns are consistent and won't cause unintended data loss.

## Summary of Changes

Resolved: all entity-to-entity FKs changed from CASCADE/SET NULL to RESTRICT in both PG and SQLite schemas. system_id and account_id FKs remain CASCADE for account/system purge flows. API DELETE endpoints check for dependents and return 409 HAS_DEPENDENTS. UI handles force-delete with strict confirmation (typing entity name). Archival is always allowed regardless of dependents.
