---
# db-vfhd
title: Innerworld tables
status: todo
type: task
priority: low
created_at: 2026-03-08T13:33:19Z
updated_at: 2026-03-08T14:21:19Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Innerworld spatial mapping tables for the 2D canvas editor.

## Scope

### Tables

- **`innerworld_entities`**: id (UUID PK), system_id (FK → systems, NOT NULL), entity_type ('member' | 'landmark', T3), region_id (FK → innerworld_regions, nullable — assigns entity to a region), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — position_x, position_y, name, description, visual properties, linked_member_id for member entities)
  - entity_type no longer includes 'region' — regions are a separate table
- **`innerworld_regions`**: id (UUID PK), system_id (FK → systems, NOT NULL), parent_region_id (FK → innerworld_regions, nullable — self-referential for nested regions), access_type ('open' | 'gatekept', T3 — needed for routing), created_at (T3, NOT NULL, default NOW()), updated_at (T3), encrypted_data (T1, NOT NULL — name, boundary polygon, description, gatekeeper_member_id)
  - gatekeeper_member_id is inside encrypted_data (T1), not plaintext — revealing gatekeeper identity to the server would leak member information
  - access_type remains T3 for routing but reveals whether regions have restricted access
- **`innerworld_canvas`**: system_id (FK → systems, PK — 1:1), encrypted_data (T1, NOT NULL — viewport state, zoom, dimensions)

### Design decisions

- gatekeeper_member_id moved to T1 encrypted_data: server should not know which member gatekeeps which region
- region_id FK on entities provides entity-to-region assignment without a separate join table
- parent_region_id enables nested region hierarchy

## Acceptance Criteria

- [ ] All 3 innerworld tables defined
- [ ] Nested regions via self-referential parent_region_id FK
- [ ] Entity-to-region assignment via region_id FK on entities
- [ ] gatekeeper_member_id inside encrypted_data (T1), not plaintext
- [ ] Canvas viewport state (1:1 with system)
- [ ] created_at/updated_at on entities and regions
- [ ] Migrations for both dialects
- [ ] Integration test: create entities, regions with nesting, and canvas state

## References

- features.md section 6 (Innerworld mapping)
