---
# db-z681
title: Refactor versionCheck boilerplate into versioned() helper
status: completed
type: task
priority: low
created_at: 2026-03-12T01:39:41Z
updated_at: 2026-04-16T07:29:39Z
parent: ps-vtws
---

The pattern `(t) => [check("foo_version_check", versionCheck(t.version))]` repeats 30+ times across schema files. Could be folded into the versioned() audit helper to reduce boilerplate.

## Summary of Changes

Added `versionCheckFor` helper to audit.pg.ts and audit.sqlite.ts that generates the standard version check constraint from a table name and column reference. Applied across all 30+ schema files, eliminating repetitive `check("table_version_check", versionCheck(t.version))` boilerplate.
