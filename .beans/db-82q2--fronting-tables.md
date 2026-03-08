---
# db-82q2
title: Fronting tables
status: todo
type: task
priority: high
created_at: 2026-03-08T13:32:47Z
updated_at: 2026-03-08T14:21:00Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Fronting session, switch, and custom front tables for the fronting engine.

## Scope

### Tables

- **`fronting_sessions`**: id (UUID PK), system_id (FK → systems, NOT NULL), start_time (T3, NOT NULL — needed for push notification triggers), end_time (T3, nullable — NULL means currently active), encrypted_data (T1, NOT NULL — member_id, fronting_type, comment, custom_front_id, subsystem_id, fronting_comments)
  - `fronting_type`: `'fronting' | 'co-conscious'` inside encrypted_data — user-specified, not computed from overlap. Co-conscious (passive awareness) cannot be inferred from session overlap.
  - `comment`: custom front status text, max 50 chars (matches SP behavior)
  - `fronting_comments`: retroactive notes/annotations on the fronting entry
  - CHECK: `end_time IS NULL OR end_time > start_time`
- **`switches`**: id (UUID PK), system_id (FK → systems, NOT NULL), timestamp (T3, NOT NULL), encrypted_data (T1, NOT NULL — outgoing/incoming member arrays)
  - Append-only event log. Switches record the moment of transition; fronting_sessions track duration ranges. Switch events are derived from session start/end transitions.
- **`custom_fronts`**: id (UUID PK), system_id (FK → systems, NOT NULL), archived (boolean, T3, NOT NULL, default false), archived_at (T3, nullable), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — name, description, color, avatar_ref)

### Design decisions

- Fronting timestamps are T3 (needed for push notification triggers to friends)
- member_id inside encrypted_data: server doesn't know WHO is fronting, only WHEN
- Overlapping sessions supported (no unique constraint on time ranges)
- custom_fronts support archival because historical fronting data references them

### Indexes

- fronting_sessions (system_id, start_time)
- fronting_sessions (system_id, end_time) — for current fronters query

## Acceptance Criteria

- [ ] fronting_sessions with nullable end_time for open sessions
- [ ] fronting_type stored inside encrypted_data (not computed from overlap)
- [ ] comment and fronting_comments inside encrypted_data
- [ ] CHECK: end_time IS NULL OR end_time > start_time
- [ ] switches table as append-only event log
- [ ] custom_fronts with archived flag and timestamps
- [ ] No unique constraint preventing overlapping sessions
- [ ] Indexes on system_id + start_time and system_id + end_time
- [ ] Migrations for both dialects
- [ ] Integration test: create overlapping sessions with co-conscious type

## References

- features.md section 2 (Fronting and Analytics)
