---
# db-gxbu
title: Ensure search_index RLS is programmatically applied after DDL creation
status: completed
type: task
priority: normal
created_at: 2026-03-13T05:00:25Z
updated_at: 2026-03-13T06:25:22Z
parent: db-hcgk
---

## Summary of Changes\n\nAdded JSDoc to `createSearchIndex()` documenting that callers must apply RLS via `generateRlsStatements` after table creation.
