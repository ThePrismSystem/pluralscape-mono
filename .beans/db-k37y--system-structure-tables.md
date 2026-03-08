---
# db-k37y
title: System structure tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:32:59Z
updated_at: 2026-03-08T13:36:25Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Relationship, subsystem, side system, layer, and membership tables

Relationship, subsystem, side system, layer, and membership tables.

## Scope

- `relationships`: id, system_id, source_member_id, target_member_id, relationship_type (varchar), bidirectional (boolean), encrypted_data (T1 — custom label, notes)
- `subsystems`: id, system_id, parent_subsystem_id (nullable FK → subsystems — recursive), architecture_type, encrypted_data (T1 — name, description, origin, has_core, discovery_status)
- `side_systems`: id, system_id, encrypted_data (T1 — name, description)
- `layers`: id, system_id, sort_order, access_type, gatekeeper_member_id (nullable), encrypted_data (T1 — name)
- `subsystem_memberships`: subsystem_id (FK), member_id (FK)

## Acceptance Criteria

- [ ] All 5 tables defined for both dialects
- [ ] Recursive subsystem nesting via self-referential FK
- [ ] Relationship type stored as varchar (extensible)
- [ ] Layer sort ordering
- [ ] Subsystem membership M:N join
- [ ] Migrations for both dialects

## References

- features.md section 6 (System Structure)
