---
# ps-tcz8
title: "PR 3: Sync layer - structure entity link upgrade + custom field CRDT fields"
status: completed
type: task
priority: normal
created_at: 2026-03-22T08:32:45Z
updated_at: 2026-03-22T08:39:54Z
parent: db-rsn2
---

Upgrade 3 junction maps (structureEntityLinks, structureEntityMemberLinks, structureEntityAssociations) to full lww-map entities. Add missing CrdtFieldDefinition.scopes and CrdtFieldValue.structureEntityId/groupId fields. Update strategies, barrel exports, tests, and docs.

## Tasks\n\n- [x] Add CrdtStructureEntityLink, CrdtStructureEntityMemberLink, CrdtStructureEntityAssociation interfaces\n- [x] Update CrdtFieldDefinition (add scopes) and CrdtFieldValue (add structureEntityId, groupId)\n- [x] Update SystemCoreDocument types (junction → lww-map)\n- [x] Update crdt-strategies.ts (junction-map → lww-map)\n- [x] Update schemas.ts barrel exports\n- [x] Update schemas.test.ts\n- [x] Update crdt-strategies.test.ts\n- [x] Update document-factory.test.ts\n- [x] Update conflict-resolution.md\n- [x] Update document-topology.md\n- [x] Verify: typecheck, lint, test, build

## Summary of Changes

Upgraded 3 junction maps (structureEntityLinks, structureEntityMemberLinks, structureEntityAssociations) to full lww-map CRDT entities with proper interfaces (CrdtStructureEntityLink, CrdtStructureEntityMemberLink, CrdtStructureEntityAssociation). Added missing CrdtFieldDefinition.scopes field and CrdtFieldValue.structureEntityId/groupId fields. Updated CRDT strategies, barrel exports, all affected tests, and 2 spec docs. All 5263 tests pass, typecheck and lint clean.
