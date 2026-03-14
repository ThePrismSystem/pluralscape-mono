---
# db-ki5y
title: Support deletion/archival for all entity types
status: in-progress
type: feature
priority: high
created_at: 2026-03-13T23:47:17Z
updated_at: 2026-03-14T02:03:01Z
---

All entity types need a user-facing way to remove accidentally created entries. Currently only 9 entities support archival (members, custom fronts, journal entries, wiki pages, groups, channels, messages, notes, field definitions). All other entities can only be removed via system-level CASCADE (account deletion), which means accidental entries are permanently stuck.

This covers types, DB schema (PG + SQLite), and RLS — API layer is out of scope.

## Design

Every entity supports **both** deletion and archival:

- **Delete**: hard-removes the record. Blocked if other entities reference it — the API returns the list of referencing entities and suggests archival instead.
- **Archive**: soft-hides the record (archived=true, archivedAt=timestamp). Always succeeds. Archived entities remain resolvable by FK but are excluded from default queries.

This is universal — no entity type is exempt (except immutable audit trails: lifecycle_events, audit_log, system_snapshots).

## Entities Needing Changes

### Already have archival, need deletion support

- Members, custom fronts, journal entries, wiki pages, groups, channels, messages, notes, field definitions

### Need both archival AND deletion added

- Fronting sessions
- Fronting comments
- Switches
- Subsystems
- Side systems
- Layers
- Relationships (member_relationships)
- Innerworld regions
- Innerworld entities
- Privacy buckets
- Board messages
- Polls
- Poll votes
- Acknowledgement requests
- Notification configs
- Friend notification preferences
- Webhook configs
- Webhook deliveries
- Timer configs
- Check-in records
- Friend connections
- Friend codes
- Blob metadata
- Member photos

### Already handled (no changes)

- API keys — revocation model (revokedAt)
- Device tokens — revocation model (revokedAt)

### Exempt (immutable audit trails)

- Lifecycle events
- Audit log
- System snapshots
- Search index (derived, rebuilt from source)

## Tasks

### Types package

- [ ] Add archived/archivedAt to all entity types missing them
- [ ] Ensure all entity types have AuditMetadata or equivalent

### DB schema (PG + SQLite)

- [ ] Add archivable() columns to all tables missing them
- [ ] Audit FK constraints to determine which entities block deletion of which

### Tests

- [ ] Archival round-trip tests for all newly archivable entities
- [ ] Deletion tests verifying FK-blocked deletes fail gracefully
- [ ] Type tests for new archived variants

### Migration

- [ ] Generate Drizzle migration for new columns

## Implementation Notes

- [ ] Commit 1: Archived<T> utility type + generalize ArchivalEvent
- [ ] Commit 2: Fronting domain archival
- [ ] Commit 3: Structure domain archival
- [ ] Commit 4: Communication domain archival
- [ ] Commit 5: Innerworld + Privacy/Social archival
- [x] Commit 6: Infrastructure domain archival
- [ ] Commit 7: Media domain archival
- [ ] Commit 8: Drizzle migration
- [ ] Commit 9: FK audit documentation

Switches comment in schema overridden — they are archivable/deletable per user decision.
Generalize ArchivalEvent to use EntityReference instead of memberId.
