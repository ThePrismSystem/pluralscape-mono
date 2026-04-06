---
# ps-92co
title: "Add missing hooks: system CRUD and multi-system"
status: completed
type: task
priority: critical
created_at: 2026-04-06T00:52:27Z
updated_at: 2026-04-06T02:44:11Z
parent: ps-y621
---

Zero hook coverage for system-level operations. Create hooks for:

- system.create, system.list, system.update, system.archive, system.duplicate, system.purge
- Blocks multi-system support, system duplication, and setup wizard

Audit ref: Pass 1 CRITICAL

## Summary of Changes\n\nAdded 7 system CRUD hooks with tests. usePurgeSystem has broad cache invalidation.
