---
# api-xxor
title: Add composite DB indexes for group_memberships and field_values
status: completed
type: task
priority: normal
created_at: 2026-03-18T15:57:46Z
updated_at: 2026-03-20T10:27:05Z
parent: api-765x
---

M14, M15: Add composite indexes on (system_id, group_id) for group_memberships and (system_id, member_id) for field_values to improve query performance.

## Acceptance Criteria

- Drizzle migration adds composite index on (system_id, group_id) for group_memberships
- Drizzle migration adds composite index on (system_id, member_id) for field_values
- Migration applies cleanly on fresh DB and existing DB with data
- Query plans for list-by-system queries use the new indexes (EXPLAIN verification)

## Summary of Changes

- Added composite index (system_id, group_id) on group_memberships table
- Added composite index (system_id, member_id) on field_values table
