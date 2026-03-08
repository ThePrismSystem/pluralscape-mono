---
# types-iz5j
title: Innerworld and spatial types
status: todo
type: task
priority: low
created_at: 2026-03-08T13:32:34Z
updated_at: 2026-03-08T14:21:58Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-fid9
---

InnerWorldEntity, InnerWorldRegion, InnerWorldCanvas, 2D positioning and gatekeeper types

Innerworld mapping and 2D canvas positioning types.

## Scope

- `InnerWorldEntity`: id, systemId, entityType ('member' | 'region' | 'landmark'), positionX, positionY, visualProperties
- `InnerWorldRegion`: id, systemId, name, boundaryData (polygon points), accessType ('open' | 'gatekept'), gatekeeperMemberId (nullable)
- `InnerWorldCanvas`: systemId, viewportX, viewportY, zoom, dimensions
- Regions can be nested (parent region)
- Gatekeeper assignment links a member to a region

## Acceptance Criteria

- [ ] 2D positioning with x/y coordinates
- [ ] Region boundary as polygon point array
- [ ] Access rules (open vs gatekept) per region
- [ ] Gatekeeper member assignment
- [ ] Canvas viewport state type
- [ ] Nested region support

## References

- features.md section 6 (Innerworld mapping)
- Note: visual editor is stretch goal for M8

## Audit Findings (002)

- InnerWorldEntity missing `linkedMemberId` — for entities of type 'member', which member they represent
- InnerWorldEntity missing `name` and `description` fields on the entity itself
- Entity type 'region' overlaps with separate InnerWorldRegion type — should use discriminated union where each variant has different required fields
- Missing entity-to-region assignment relationship
