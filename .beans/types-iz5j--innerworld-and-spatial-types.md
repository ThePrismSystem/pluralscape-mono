---
# types-iz5j
title: Innerworld and spatial types
status: completed
type: task
priority: low
created_at: 2026-03-08T13:32:34Z
updated_at: 2026-03-09T06:05:29Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-fid9
---

Innerworld mapping and 2D canvas positioning types.

## Scope

`InnerWorldEntity` is a discriminated union on entityType:

- `MemberEntity`: entityType 'member', linkedMemberId (MemberId), name, description, positionX, positionY, visualProperties, regionId (InnerWorldRegionId | null)
- `LandmarkEntity`: entityType 'landmark', name, description, positionX, positionY, visualProperties, regionId (InnerWorldRegionId | null)

All variants share: id (InnerWorldEntityId), systemId

- `InnerWorldRegion`: id (InnerWorldRegionId), systemId, name, description, boundaryData (polygon points), parentRegionId (InnerWorldRegionId | null — nested regions), accessType ('open' | 'gatekept'), gatekeeperMemberId (MemberId | null), createdAt, updatedAt
- `InnerWorldCanvas`: systemId, viewportX, viewportY, zoom, dimensions

## Acceptance Criteria

- [ ] InnerWorldEntity as discriminated union (MemberEntity, LandmarkEntity)
- [ ] MemberEntity has linkedMemberId
- [ ] All entity variants have name, description, regionId
- [ ] Region boundary as polygon point array
- [ ] Nested regions via parentRegionId
- [ ] Gatekeeper member assignment per region
- [ ] Canvas viewport state type
- [ ] Unit tests for entity type narrowing

## References

- features.md section 6 (Innerworld mapping)

## Summary of Changes

Created innerworld.ts with VisualProperties, MemberEntity, LandmarkEntity, InnerWorldEntityData (discriminated on kind), InnerWorldEntity, InnerWorldRegion, InnerWorldCanvas. Branch: feat/types-domain-features.
