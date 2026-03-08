---
# db-k37y
title: System structure tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:32:59Z
updated_at: 2026-03-08T14:21:18Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Relationship, subsystem, side system, layer, and membership tables

## Scope

- `relationships`: id, system_id, encrypted_data (T1 — source_member_id, target_member_id, relationship_type, bidirectional, custom label, notes)
- `subsystems`: id, system_id, parent_subsystem_id (nullable FK → subsystems — recursive), encrypted_data (T1 — name, description, origin, has_core, discovery_status, architecture_type)
- `side_systems`: id, system_id, encrypted_data (T1 — name, description)
- `layers`: id, system_id, sort_order, encrypted_data (T1 — name, access_type, gatekeeper_member_id)
- `subsystem_memberships`: encrypted_data (T1 — subsystem_id, member_id)
- Privacy note: member_id references are inside encrypted_data (T1) so the server cannot learn system structure. This matches db-82q2's approach where member_id is encrypted ("server doesn't know WHO"). Only system_id and structural IDs (subsystem hierarchy) are plaintext.

## Acceptance Criteria

- [ ] All 5 tables defined for both dialects
- [ ] Recursive subsystem nesting via self-referential FK
- [ ] Relationship type stored as varchar (extensible)
- [ ] Layer sort ordering
- [ ] Subsystem membership M:N join
- [ ] Migrations for both dialects

## References

- features.md section 6 (System Structure)

## Audit Findings (002)

- subsystem_memberships has no queryable columns — both IDs are inside encrypted_data, making the table unusable for joins. Needs at minimum a surrogate `id` column and `system_id` FK for RLS
- Missing `side_system_memberships` join table (M:N for members in side systems)
- Missing `layer_memberships` join table (M:N for members in layers)
- Missing `created_at`, `updated_at` on relationships, subsystems, side_systems, layers
- Missing `created_at`, `updated_at` on innerworld tables (also update db-vfhd)
