---
# ps-a447
title: Fix all PR review issues for member domain API
status: completed
type: task
priority: normal
created_at: 2026-03-17T22:11:54Z
updated_at: 2026-03-17T22:34:49Z
---

Address 5 critical, 6 important, and 7 suggestion-level issues from PR review across services, routes, types, and tests. 5 commits total.

## Plan

- [x] Commit 1: Extract shared helpers and consolidate FieldType source of truth
- [x] Commit 2: Resolve critical data integrity issues in service layer
- [x] Commit 3: Add missing guard checks and cascade field values on archive
- [x] Commit 4: Normalize archive semantics to POST pattern with photo restore
- [x] Commit 5: Add missing route tests and cross-system access tests

## Summary of Changes

All 18 PR review issues addressed across 5 commits:

- Extracted shared helpers (encryptedBlobToBase64, assertMemberActive, assertFieldDefinitionActive)
- Consolidated FieldType to single source of truth in types package
- Fixed TOCTOU races by moving quota checks inside transactions
- Added returning checks to reorder/duplicate operations
- Added null guard for memberId in field value results
- Fixed pagination orderBy mismatch in listFieldDefinitions
- Added assertMemberActive to deleteFieldValue and assertFieldDefinitionActive to updateFieldValue
- Cascade-delete field values on member archive
- Normalized archive endpoints from DELETE to POST /:id/archive
- Added restoreMemberPhoto service function and route
- Added member-photo.restored audit event type
- Added 12 new route test files and 4 cross-system access tests
