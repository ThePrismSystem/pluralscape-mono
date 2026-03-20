---
# api-4wex
title: Use explicit column selection in group membership list query
status: completed
type: task
priority: low
created_at: 2026-03-18T15:58:21Z
updated_at: 2026-03-20T18:58:59Z
parent: api-765x
---

L8: Replace select(\*) with explicit column selection in group membership list queries.

## Acceptance Criteria

- Group membership list query uses explicit column selection instead of select(\*)
- Response contains only expected fields (no internal/DB-only columns leaked)
- No behavioral change to API response shape
- Integration test: verify response contains only documented fields

## Summary of Changes

Implemented as part of feat/api-hardening-audit-013-remaining.
