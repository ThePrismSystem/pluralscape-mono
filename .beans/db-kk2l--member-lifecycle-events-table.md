---
# db-kk2l
title: Member lifecycle events table
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:33:02Z
updated_at: 2026-03-08T13:36:25Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Append-only lifecycle event log table

Append-only lifecycle event log table.

## Scope

- `lifecycle_events`: id, system_id, event_type (varchar), timestamp, encrypted_data (T1 — involved_member_ids, resulting_member_ids, notes)
- Append-only: no UPDATE or DELETE operations. Enforce via application layer (no DB-level constraint on SQLite)
- PostgreSQL: consider using a rule or trigger to prevent updates
- Index: system_id + timestamp for chronological queries

## Acceptance Criteria

- [ ] lifecycle_events table defined
- [ ] Append-only pattern documented and enforced in application
- [ ] Index on (system_id, timestamp)
- [ ] Migrations for both dialects
- [ ] Integration test: insert events and query chronologically

## References

- features.md section 6 (Member lifecycle events)
