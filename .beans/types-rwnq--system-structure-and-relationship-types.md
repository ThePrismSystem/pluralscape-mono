---
# types-rwnq
title: System structure and relationship types
status: todo
type: task
priority: normal
created_at: 2026-03-08T13:32:20Z
updated_at: 2026-03-08T14:21:49Z
parent: types-im7i
blocked_by:
  - types-av6x
  - types-fid9
---

System structure types for relationships, subsystems, side systems, and layers.

## Scope

- `Relationship`: id (RelationshipId), systemId, sourceMemberId, targetMemberId, type (RelationshipType), bidirectional (boolean), label (custom string for custom type), createdAt
- `RelationshipType`: 'split-from' | 'fused-from' | 'sibling' | 'partner' | 'parent-child' | 'protector-of' | 'caretaker-of' | 'gatekeeper-of' | 'source' | 'custom'
- `Subsystem`: id (SubsystemId), systemId, parentSubsystemId (nullable — recursive), name, description, architectureType (ArchitectureType), originType (OriginType), hasCoreFlag (boolean), discoveryStatus (DiscoveryStatus), createdAt, updatedAt
- `ArchitectureType`: 'orbital' | 'compartmentalized' | 'webbed' | 'mixed'
- `OriginType`: 'traumagenic' | 'endogenic' | 'mixed' | 'unknown' | 'prefer-not-to-say' | 'custom'
- `DiscoveryStatus`: 'fully-mapped' | 'partially-mapped' | 'still-discovering'
- `SideSystem`: id (SideSystemId), systemId, name, description, createdAt, updatedAt — parallel group, not nested
- `Layer`: id (LayerId), systemId, sortOrder, name, description, accessType ('open' | 'gatekept'), gatekeeperMemberId (MemberId | null), createdAt, updatedAt
- `SubsystemMembership`: subsystemId, memberId
- `SideSystemMembership`: sideSystemId, memberId
- `LayerMembership`: layerId, memberId
- No hard depth limit for nesting (polyfragmented support)

### Polyfragmented system modeling (from ps-qvj0)

- Architecture types (orbital, compartmentalized, webbed, mixed) describe subsystem internal organization
- Recursive subsystem nesting with no artificial depth limit supports polyfragmented systems
- Side systems model parallel groups that exist alongside the main hierarchy
- Layers model vertically stacked divisions with independent access rules

## Acceptance Criteria

- [ ] Relationship type covers all 10 edge types from features.md
- [ ] Bidirectional flag per relationship
- [ ] Subsystem supports recursive nesting (no depth limit)
- [ ] OriginType union with 6 values including 'prefer-not-to-say'
- [ ] SideSystem as parallel (not nested) container
- [ ] Layer with description and optional gatekeeper assignment
- [ ] SideSystemMembership and LayerMembership types
- [ ] Timestamps on all structure types
- [ ] Discovery status tracking
- [ ] Unit tests for relationship graph traversal helpers

## References

- features.md section 6 (System Structure)
