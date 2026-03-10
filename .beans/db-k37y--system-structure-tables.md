---
# db-k37y
title: System structure tables
status: completed
type: task
priority: normal
created_at: 2026-03-08T13:32:59Z
updated_at: 2026-03-10T01:37:20Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Relationship, subsystem, side system, layer, and membership tables for system structure modeling.

## Scope

### Tables

- **`relationships`**: id (UUID PK), system_id (FK → systems, NOT NULL), version (integer, T3, default 1), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — source_member_id, target_member_id, relationship_type, bidirectional, custom label, notes)
- **`subsystems`**: id (UUID PK), system_id (FK → systems, NOT NULL), parent_subsystem_id (FK → subsystems, nullable — recursive nesting), version (integer, T3, default 1), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — name, description, has_core, discovery_status, architecture_type, color, imageSource, emoji)
- **`side_systems`**: id (UUID PK), system_id (FK → systems, NOT NULL), version (integer, T3, default 1), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — name, description, color, imageSource, emoji)
- **`layers`**: id (UUID PK), system_id (FK → systems, NOT NULL), sort_order (integer, T3), version (integer, T3, default 1), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — name, description, access_type, gatekeeper_member_ids, color, imageSource, emoji)
- **`subsystem_memberships`**: id (UUID PK), subsystem_id (FK → subsystems, NOT NULL — structural, exposed via parent chain), system_id (FK → systems, NOT NULL — for RLS), created_at (T3, NOT NULL, default NOW()), encrypted_data (T1, NOT NULL — member_id)
  - subsystem_id is plaintext because subsystem hierarchy is already exposed via the parent chain; member_id remains T1 encrypted
  - Composite unique on (subsystem_id, encrypted member) enforced at application layer
- **`side_system_memberships`**: id (UUID PK), side_system_id (FK → side_systems, NOT NULL), system_id (FK → systems, NOT NULL — for RLS), created_at (T3, NOT NULL, default NOW()), encrypted_data (T1, NOT NULL — member_id)
- **`layer_memberships`**: id (UUID PK), layer_id (FK → layers, NOT NULL), system_id (FK → systems, NOT NULL — for RLS), created_at (T3, NOT NULL, default NOW()), encrypted_data (T1, NOT NULL — member_id)

### Design decisions

- Privacy: member_id references are inside encrypted_data (T1) so the server cannot learn system structure. Only system_id and structural IDs are plaintext.
- CRDT: `version` column on relationships, subsystems, side_systems, layers for optimistic locking during sync.
- Cascade: system deletion → CASCADE all 10 structure tables (GDPR purge path).

### Indexes

- subsystem_memberships (subsystem_id), (system_id)
- side_system_memberships (side_system_id), (system_id)
- layer_memberships (layer_id), (system_id)

## Acceptance Criteria

- [x] All 10 tables defined for both dialects (PG + SQLite) — 7 original + 3 cross-links
- [x] Cross-link tables for subsystem↔layer, subsystem↔side_system, side_system↔layer
- [x] Visual properties (color, imageSource, emoji) on subsystems, side_systems, layers
- [x] gatekeeper_member_ids (plural) in layers encrypted_data
- [x] Recursive subsystem nesting via self-referential FK
- [x] Relationship type stored as varchar (extensible)
- [x] Layer sort ordering
- [x] subsystem_memberships has surrogate id and plaintext subsystem_id for queryability
- [x] side_system_memberships M:N join table defined
- [x] layer_memberships M:N join table defined
- [x] version column on relationships, subsystems, side_systems, layers
- [x] created_at/updated_at on all 10 tables
- [x] NOT NULL on id, system_id, encrypted_data, created_at
- [x] CASCADE on system deletion for all structure tables
- [x] Migrations for both dialects

## References

- features.md section 6 (System Structure)

### Cross-link tables (from audit C4)

- **`subsystem_layer_links`**: id (UUID PK), subsystem_id (FK → subsystems, NOT NULL), layer_id (FK → layers, NOT NULL), system_id (FK → systems, NOT NULL — for RLS), created_at (T3, NOT NULL, default NOW()), encrypted_data (T1, nullable — notes)
  - Unique: (subsystem_id, layer_id)
- **`subsystem_side_system_links`**: id (UUID PK), subsystem_id (FK → subsystems, NOT NULL), side_system_id (FK → side_systems, NOT NULL), system_id (FK → systems, NOT NULL — for RLS), created_at (T3, NOT NULL, default NOW()), encrypted_data (T1, nullable — notes)
  - Unique: (subsystem_id, side_system_id)
- **`side_system_layer_links`**: id (UUID PK), side_system_id (FK → side_systems, NOT NULL), layer_id (FK → layers, NOT NULL), system_id (FK → systems, NOT NULL — for RLS), created_at (T3, NOT NULL, default NOW()), encrypted_data (T1, nullable — notes)
  - Unique: (side_system_id, layer_id)
- All cross-link tables CASCADE on system deletion
- Indexes: each link table indexed on both FK columns

## Summary of Changes

Added 10 structure tables (PG + SQLite): relationships, subsystems (self-referential SET NULL), side_systems, layers, 3 membership junctions, 3 cross-link tables with unique constraints. 66 integration tests.
