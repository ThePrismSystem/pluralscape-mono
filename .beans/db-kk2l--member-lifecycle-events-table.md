---
# db-kk2l
title: Member lifecycle events table
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:33:02Z
updated_at: 2026-03-09T23:00:43Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Append-only lifecycle event log table for tracking member splits, fusions, merges, dormancy, and other events.

## Scope

### Tables

- **`lifecycle_events`**: id (UUID PK, NOT NULL), system_id (FK → systems, NOT NULL), occurred_at (T3, NOT NULL — when the event actually happened), recorded_at (T3, NOT NULL, default NOW() — when it was logged), encrypted_data (T1, NOT NULL — event_type, involved_member_ids, resulting_member_ids, notes)
  - event_type is inside encrypted_data (T1): reveals sensitive system dynamics (splits, fusions, dormancy) that should not be visible to the server
  - No plaintext event_type column

### Design decisions

- Append-only: no UPDATE or DELETE operations. Enforced via application layer; PostgreSQL rule/trigger optional.
- event_type moved from plaintext to T1: the server knowing that a split or fusion occurred leaks sensitive information about system dynamics

### Indexes

- lifecycle_events (system_id, occurred_at) — chronological queries
- lifecycle_events (system_id, recorded_at) — for sync ordering
- No event_type index (field is now encrypted)

## Acceptance Criteria

- [ ] lifecycle_events table with event_type inside encrypted_data
- [ ] No plaintext event_type column
- [ ] Append-only pattern enforced in application
- [ ] occurred_at and recorded_at split timestamps
- [ ] Index on (system_id, occurred_at) and (system_id, recorded_at)
- [ ] Migrations for both dialects
- [ ] Integration test: insert events and query chronologically

## References

- features.md section 6 (Member lifecycle events)

### Cascade rules

- System deletion → CASCADE: lifecycle_events
