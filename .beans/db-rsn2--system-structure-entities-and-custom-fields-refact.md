---
# db-rsn2
title: System structure entities and custom fields refactor
status: completed
type: epic
priority: normal
created_at: 2026-03-22T01:30:48Z
updated_at: 2026-04-16T07:29:48Z
parent: ps-mmpz
---

Replace 9 rigid structure tables (subsystems, side_systems, layers + 3 membership junctions + 3 cross-link junctions) with generic entity model. Expand custom fields to support groups and structure entity types. Add structure entities as fronting session subjects. 3-PR series: types, db, sync.

## Summary of Changes

Completed via 3 merged PRs (#236, #237, #238):

- **PR #236 (types):** Added generic structure entity types to `packages/types` — SystemStructureEntityType, SystemStructureEntity, SystemStructureEntityLink, SystemStructureEntityMemberLink, SystemStructureEntityAssociation, FieldDefinitionScope. Updated FrontingSession to use structureEntityId instead of linkedStructure jsonb. Updated FieldValue with structureEntityId and groupId owner columns.

- **PR #237 (db):** Replaced 9 tables (subsystems, side_systems, layers + 3 membership junctions + 3 cross-link junctions) with 5 generic tables: system_structure_entity_types, system_structure_entities, system_structure_entity_links, system_structure_entity_member_links, system_structure_entity_associations. Added field_definition_scopes table. Extended field_values with structure_entity_id and group_id. Extended fronting_sessions with structure_entity_id (replacing linked_structure jsonb).

- **PR #238 (sync):** Upgraded structure entity link CRDT documents from junction-style to LWW-Map registers, aligned sync document topology with the new generic entity model.
