---
# db-aatw
title: Evaluate onDelete cascade behavior for DB tables
status: todo
type: task
created_at: 2026-03-17T01:31:16Z
updated_at: 2026-03-17T01:31:16Z
---

Audit all onDelete configurations across DB tables to verify cascade/restrict/set-null behavior matches intended data lifecycle. Ensure hard deletes, soft deletes, and archive patterns are consistent and won't cause unintended data loss.
