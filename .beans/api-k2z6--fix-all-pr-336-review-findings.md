---
# api-k2z6
title: "Fix all PR #336 review findings"
status: completed
type: task
priority: normal
created_at: 2026-03-30T23:56:19Z
updated_at: 2026-03-31T00:09:03Z
---

Address all 9 findings from PR #336 multi-agent review: validation max-length constraints, Cache-Control middleware, Content-Type exact match, audit script fixes

## Summary of Changes

### Group A: Validation max-length constraints

- Added `.max(MAX_LOCALE_LENGTH)` to locale field in report.ts
- Added `.max(MAX_CURSOR_LENGTH)` to cursor fields in report.ts, friend-export.ts, friend.ts
- Added boundary tests for all constrained fields plus resource_type companion test

### Group B: Cache-Control middleware

- Added no-store middleware to authRoutes and accountRoutes parent routers
- Removed 7 redundant per-handler Cache-Control calls
- Updated 4 test files to mount through authRoutes for Cache-Control assertions

### Group C: Content-Type exact match

- Changed parseJsonBody from startsWith to exact media type comparison (split on semicolon)
- Added application/jsonl rejection test, upgraded ErrorBody to use ApiErrorCode type

### Group D: Audit script fixes

- Added HttpMethod type, tightened RouteMethod and RouteInventoryEntry
- Removed unused \_filename parameter and reverted eslint override
- Narrowed bare catch to ENOENT-specific with re-throw
- Exported normalizePath, added 9 tests (normalizePath + buildInventory)
