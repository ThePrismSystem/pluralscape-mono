---
# ps-a447
title: Fix all PR review issues for member domain API
status: in-progress
type: task
priority: normal
created_at: 2026-03-17T22:11:54Z
updated_at: 2026-03-17T22:26:03Z
---

Address 5 critical, 6 important, and 7 suggestion-level issues from PR review across services, routes, types, and tests. 5 commits total.

## Plan

- [x] Commit 1: Extract shared helpers and consolidate FieldType source of truth
- [x] Commit 2: Resolve critical data integrity issues in service layer
- [x] Commit 3: Add missing guard checks and cascade field values on archive
- [ ] Commit 4: Normalize archive semantics to POST pattern with photo restore
- [ ] Commit 5: Add missing route tests and cross-system access tests
