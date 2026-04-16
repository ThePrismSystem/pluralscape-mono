---
# types-ft91
title: Batch type, docs, and bean updates
status: completed
type: feature
priority: normal
created_at: 2026-03-09T10:48:00Z
updated_at: 2026-04-16T07:29:42Z
parent: types-im7i
---

Close ~20 gaps between type definitions/docs and feature requirements: member images, notifications, fronting comments, structure enhancements, innerworld linking, new lifecycle events, poll overhaul, friend visibility, saturation levels, tag expansion, nomenclature categories

## Completed Phases

- [x] Phase 1: Foundation — `image-source.ts` (new), `ids.ts` (FrontingCommentId)
- [x] Phase 2: Identity — `identity.ts` (SaturationLevel, Tag, ImageSource, notification bools)
- [x] Phase 3: Structure — `structure.ts` (ArchitectureType, visual props, junctions)
- [x] Phase 4: Fronting — `fronting.ts` (FrontingComment, linkedStructure)
- [x] Phase 5: Inner World — `innerworld.ts` (5 entity variants, visual props)
- [x] Phase 6: Lifecycle — `lifecycle.ts` (3 new events)
- [x] Phase 7: Polls — `communication.ts` (PollKind, voter entity ref, abstain/veto)
- [x] Phase 8: Privacy — `privacy.ts` (FriendVisibilitySettings)
- [x] Phase 9: Nomenclature — `nomenclature.ts` (4 new categories, removed Wonderland)
- [x] Phase 10: Settings — `settings.ts` (saturationLevelsEnabled)
- [x] Phase 11: Encryption — `encryption.ts` (cascaded all domain changes)
- [x] Phase 12: Barrel — `index.ts` (all new exports)
- [x] Phase 13: Tests — all type-level tests updated + new image-source.test.ts
- [x] Phase 14: Documentation — `features.md` updated across §1, §2, §3, §4, §6, §12
- [x] Removed deprecated aliases (CompletenessLevel, KnownRoleTag, RoleTag) — no consumers exist

## Summary of Changes

Closed ~20 gaps between type definitions and feature spec. Key changes:

- New `ImageSource` discriminated union for blob/external image refs
- `SaturationLevel` replaces `CompletenessLevel` as a discriminated union (known/custom)
- `Tag` replaces `RoleTag` with 17 known tags + custom support
- `FrontingComment` entity for multiple comments per fronting session
- `linkedStructure` polymorphic entity reference on fronting sessions
- Poll overhaul: kinds, description, end date, abstain/veto, voter entity refs
- `FriendVisibilitySettings` for per-friend granular visibility
- 3 new lifecycle events: subsystem formation, form change, name change
- 5 innerworld entity variants (member, landmark, subsystem, side-system, layer)
- 8 architecture types, cross-structure junction types
- 4 new nomenclature categories (dormancy, body, amnesia, saturation)
- All encryption Server/Client pairs updated
- 818 tests pass, typecheck clean across 8 packages, zero lint warnings
