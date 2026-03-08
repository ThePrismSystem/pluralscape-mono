---
# db-vfhd
title: Innerworld tables
status: todo
type: task
priority: low
created_at: 2026-03-08T13:33:19Z
updated_at: 2026-03-08T13:36:25Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Innerworld spatial mapping tables

## Scope

- `innerworld_entities`: id, system_id, entity_type ('member'|'region'|'landmark'), encrypted_data (T1 — position_x, position_y, name, description, visual properties)
- `innerworld_regions`: id, system_id, parent_region_id (nullable), access_type ('open'|'gatekept'), gatekeeper_member_id (nullable), encrypted_data (T1 — name, boundary polygon, description)
- `innerworld_canvas`: system_id (PK), encrypted_data (T1 — viewport state, zoom, dimensions)

## Acceptance Criteria

- [ ] All 3 innerworld tables defined
- [ ] Nested regions via parent_region_id
- [ ] Gatekeeper assignment
- [ ] Canvas viewport state (1:1 with system)
- [ ] Migrations for both dialects
- [ ] Integration test: create entities, regions, and canvas state

## References

- features.md section 6 (Innerworld mapping)
