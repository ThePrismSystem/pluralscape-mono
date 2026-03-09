---
# types-rwnq
title: System structure and relationship types
status: completed
type: task
priority: normal
created_at: 2026-03-08T13:32:20Z
updated_at: 2026-03-09T00:50:45Z
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

- [x] RelationshipType 10-member union
- [x] Relationship immutable (no AuditMetadata, just createdAt)
- [x] Subsystem with recursive parentSubsystemId (no depth limit)
- [x] OriginType 6-member union including prefer-not-to-say
- [x] SideSystem as parallel container with AuditMetadata
- [x] Layer with LayerAccessType and nullable gatekeeperMemberId
- [x] SubsystemMembership, SideSystemMembership, LayerMembership junctions
- [x] AuditMetadata on Subsystem, SideSystem, Layer
- [x] DiscoveryStatus 3-member union
- [x] Unit tests for all structure types with exhaustive switch coverage

## References

- features.md section 6 (System Structure)

## Summary of Changes

Implemented in `packages/types/src/structure.ts`:

- `RelationshipType` 10-member union, `Relationship` immutable record
- `ArchitectureType` 4-member union
- `OriginType` 6-member union, `DiscoveryStatus` 3-member union
- `LayerAccessType` extracted as own type
- `Subsystem` with recursive parent, `SideSystem`, `Layer` with gatekeeper
- 3 membership junction types (2 fields each)
- Full test coverage in `structure.test.ts`
