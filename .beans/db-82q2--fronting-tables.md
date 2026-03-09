---
# db-82q2
title: Fronting tables
status: todo
type: task
priority: high
created_at: 2026-03-08T13:32:47Z
updated_at: 2026-03-09T23:20:59Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Fronting session, switch, and custom front tables for the fronting engine.

## Scope

### Tables

- **`fronting_sessions`**: id (UUID PK), system_id (FK → systems, NOT NULL), version (integer, T3, NOT NULL, default 1), start_time (T3, NOT NULL — needed for push notification triggers), end_time (T3, nullable — NULL means currently active), encrypted_data (T1, NOT NULL — member_id, fronting_type, positionality, comment, custom_front_id, linked_structure (EntityReference))
  - `fronting_type`: `'fronting' | 'co-conscious'` inside encrypted_data — whether the member is fully fronting or co-conscious (passive awareness)
  - `positionality`: free-text string (nullable) — description of fronting positionality (e.g. close vs far, height)
  - `linked_structure`: optional EntityReference (entityType + entityId) linking session to a subsystem, side system, or layer
  - `comment`: custom front status text, max 50 chars (matches SP behavior)
  - Comments are a separate `fronting_comments` table (see below)
  - CHECK: `end_time IS NULL OR end_time > start_time`
- **`switches`**: id (UUID PK), system_id (FK → systems, NOT NULL), timestamp (T3, NOT NULL), encrypted_data (T1, NOT NULL — memberIds (non-empty array of MemberId))
  - Append-only event log. Switches record the moment of transition; fronting_sessions track duration ranges. Switch events are derived from session start/end transitions.
- **`custom_fronts`**: id (UUID PK), system_id (FK → systems, NOT NULL), version (integer, T3, NOT NULL, default 1), archived (boolean, T3, NOT NULL, default false), archived_at (T3, nullable), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — name, description, color, emoji)

### Design decisions

- Fronting timestamps are T3 (needed for push notification triggers to friends)
- member_id inside encrypted_data: server doesn't know WHO is fronting, only WHEN
- Overlapping sessions supported (no unique constraint on time ranges)
- custom_fronts support archival because historical fronting data references them

### Indexes

- fronting_sessions (system_id, start_time)
- fronting_sessions (system_id, end_time) — for current fronters query
- switches (system_id, timestamp) — for chronological switch history

### Cascade rules

- System deletion → CASCADE: fronting_sessions, switches, custom_fronts
- Switches are append-only event logs stored separately for efficient timeline queries

## Acceptance Criteria

- [ ] fronting_sessions with nullable end_time for open sessions
- [ ] fronting_type ('fronting' | 'co-conscious') stored inside encrypted_data
- [ ] positionality (free-text, nullable) stored inside encrypted_data
- [ ] linked_structure as EntityReference in encrypted_data
- [ ] fronting_comments as separate table with session FK
- [ ] emoji field in custom_fronts encrypted_data
- [ ] comment inside encrypted_data (fronting_comments moved to separate table)
- [ ] CHECK: end_time IS NULL OR end_time > start_time
- [ ] switches table as append-only event log
- [ ] custom_fronts with archived flag and timestamps
- [ ] version on fronting_sessions and custom_fronts for CRDT
- [ ] CASCADE on system deletion
- [ ] Index on switches (system_id, timestamp)
- [ ] No unique constraint preventing overlapping sessions
- [ ] Indexes on system_id + start_time and system_id + end_time
- [ ] Migrations for both dialects
- [ ] Integration test: create overlapping sessions with co-conscious type

## References

- features.md section 2 (Fronting and Analytics)

### Additional tables (from audit C1)

- **`fronting_comments`**: id (UUID PK), session_id (FK → fronting_sessions, NOT NULL), system_id (FK → systems, NOT NULL — for RLS), version (integer, T3, NOT NULL, default 1), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — member_id, content)
  - Separate table allows independent CRDT versioning and pagination
  - Session deletion → CASCADE: fronting_comments
  - Index: fronting_comments (session_id, created_at)
