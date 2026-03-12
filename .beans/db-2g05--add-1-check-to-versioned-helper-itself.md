---
# db-2g05
title: Add >= 1 check to versioned() helper itself
status: completed
type: task
priority: normal
created_at: 2026-03-11T04:47:31Z
updated_at: 2026-03-12T00:49:47Z
parent: db-gt84
---

versioned() sets default 1 but only some tables add explicit >= 1 check. Move check into helper for consistency. Ref: audit M2

## Summary of Changes

Added `versionCheck()` and `archivableConsistencyCheck()` SQL fragment helpers to `check.ts`. Applied version CHECK constraints to all 31 versioned tables and archivable CHECK constraints to all 9 archivable tables across both PG and SQLite schemas.
