---
# types-vm6k
title: "PR 1: Types foundation for structure entity refactor"
status: completed
type: task
priority: normal
created_at: 2026-03-22T01:31:00Z
updated_at: 2026-03-22T02:10:47Z
parent: db-rsn2
---

Remove old structure types (Subsystem, SideSystem, Layer + 6 junction types, 7 ID prefixes). Add new generic types (SystemStructureEntityType, SystemStructureEntity, 3 link types, 6 ID prefixes). Update fronting, innerworld, custom-fields, lifecycle, encryption, snapshot, communication, privacy types.

## Tasks

- [ ] Update ids.ts (remove 7 prefixes, add 6, update EntityType union)
- [ ] Rewrite structure.ts (remove old types, add 5 new types)
- [ ] Update fronting.ts (add structureEntityId, update linkedStructure)
- [ ] Update innerworld.ts (genericize 3 linked IDs to 1)
- [ ] Update custom-fields.ts (add scopes, polymorphic field values)
- [ ] Update lifecycle.ts (entity references)
- [ ] Update encryption.ts (Server/Client types, tier maps)
- [ ] Update communication.ts (PollVote.voter)
- [ ] Update snapshot.ts (replace structure snapshots)
- [ ] Update privacy.ts (BucketContentEntityType)
- [ ] Update index.ts barrel exports
- [ ] Update all types tests
- [ ] Typecheck + lint + test green

## Summary of Changes

Replaced all old structure entity types (Subsystem, SideSystem, Layer + 6 junction types) with generic types (SystemStructureEntityType, SystemStructureEntity + 3 link types). Updated fronting sessions to support structure entities as primary subjects. Expanded custom fields with scopes and polymorphic field values. Genericized innerworld entity links. Updated all downstream packages (db enums, validation schemas, API routes) and removed obsolete subsystem/side-system/layer route files and services.
