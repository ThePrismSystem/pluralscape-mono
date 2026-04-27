---
# types-8f84
title: SnapshotContent uses server-shaped junction types — consider plaintext-snapshot projections
status: todo
type: task
priority: normal
created_at: 2026-04-27T13:11:45Z
updated_at: 2026-04-27T14:14:50Z
---

Pre-existing on main, surfaced during ps-qmyt code review (PR3 of M9a closeout).

`SnapshotContent` (in `packages/types/src/entities/system-snapshot.ts`) references `SystemStructureEntityLink`, `SystemStructureEntityMemberLink`, and `SystemStructureEntityAssociation` directly via the `structureEntityLinks`, `structureEntityMemberLinks`, and `structureEntityAssociations` fields. These types include server-shaped fields like `systemId` and `createdAt` which clients faithfully snapshot inside the encrypted blob.

The existing convention in the same type uses dedicated `SnapshotMember`, `SnapshotGroup`, etc. projections that omit server-only fields. The three junction types break that convention.

## Proposal

Add `SnapshotStructureEntityLink`, `SnapshotStructureEntityMemberLink`, `SnapshotStructureEntityAssociation` projections matching the existing snapshot-projection convention. Update `SnapshotContentSchema` (`packages/validation/src/snapshot.ts`) accordingly.

## Acceptance

- `SnapshotContent` references only `Snapshot*` projections, not the server-shaped types
- `SnapshotContentSchema` parity test still passes
- No data migration needed (snapshots are encrypted blobs and clients re-render from current snapshot logic)
