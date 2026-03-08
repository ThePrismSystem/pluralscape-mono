---
# db-8su3
title: Nomenclature settings table
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:33:09Z
updated_at: 2026-03-08T13:36:25Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-i2gl
---

Per-system nomenclature preferences table

Per-system nomenclature preferences table.

## Scope

- `nomenclature_settings`: system_id (FK, PK), encrypted_data (T1 — 8 term category values: collective, individual, fronting, switching, co_presence, internal_space, primary_fronter, structure)
- Each term is either a preset string or custom string
- Stored as T1 (encrypted) — terminology choices could reveal information about the system
- One row per system (1:1 relationship)

## Acceptance Criteria

- [ ] nomenclature_settings table with system_id as PK
- [ ] All 8 term categories in encrypted blob
- [ ] 1:1 relationship with systems table
- [ ] Migrations for both dialects
- [ ] Integration test: set and retrieve nomenclature

## References

- features.md section 12 (Configurable Nomenclature)
