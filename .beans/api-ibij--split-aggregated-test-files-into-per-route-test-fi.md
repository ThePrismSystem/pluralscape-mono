---
# api-ibij
title: Split aggregated test files into per-route test files
status: completed
type: task
priority: low
created_at: 2026-03-18T15:58:21Z
updated_at: 2026-03-20T18:37:09Z
parent: api-765x
---

L10: Break large aggregated test files into smaller per-route test files for better maintainability.

## Acceptance Criteria

- Large test files (>500 lines) split into per-route or per-feature test files
- Each test file covers a single route or closely related set of routes
- All existing tests preserved (no test removals)
- Test organization follows convention: `__tests__/<route-name>.test.ts`

## Summary of Changes

Already implemented — 95 per-route test files already exist, no aggregated files remain.
