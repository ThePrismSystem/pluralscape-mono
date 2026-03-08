---
# db-82q2
title: Fronting tables
status: todo
type: task
priority: high
created_at: 2026-03-08T13:32:47Z
updated_at: 2026-03-08T13:36:25Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Fronting session, switch, and custom front tables

## Scope

- `fronting_sessions`: id, system_id, start_time (T3 — timestamp), end_time (T3 — nullable timestamp), encrypted_data (T1 — member_id, comment, custom_front_id, subsystem_id)
- `switches`: id, system_id, timestamp (T3), encrypted_data (T1 — outgoing/incoming member arrays)
- `custom_fronts`: id, system_id, encrypted_data (T1 — name, description, color)
- Design: fronting timestamps are T3 (needed for push notification triggers)
- Design: member_id inside encrypted_data (server doesn't know WHO is fronting, only WHEN)
- Overlapping sessions supported (no unique constraint on time ranges)
- FrontingType ('fronting' | 'co-fronting' | 'co-conscious') is computed from overlapping sessions, not stored — no column needed

## Acceptance Criteria

- [ ] fronting_sessions table with nullable end_time for open sessions
- [ ] switches table linking to timestamp
- [ ] custom_fronts table
- [ ] No unique constraint preventing overlapping sessions (co-fronting)
- [ ] Indexes: system_id + start_time for range queries
- [ ] Migration for both dialects
- [ ] Integration test: create overlapping sessions

## References

- features.md section 2 (Fronting)
- encryption-research.md section 4.3 (fronting encryption tiers)
