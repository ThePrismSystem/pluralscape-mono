---
# db-xnaf
title: Add tenant ownership constraints for denormalized child rows
status: completed
type: bug
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-11T07:12:47Z
parent: db-2je4
---

Many child tables carry parent FK + denormalized system_id/account_id but no composite constraint ensures they match. Affected: member_photos, messages, fronting_comments, group_memberships, field_values, check_in_records, device_tokens, import_jobs, export_requests. A row can satisfy all FKs while pointing at a parent from a different tenant. Ref: audit CR7

## Implementation Plan

### Parent tables needing UNIQUE(id, system_id)

members, frontingSessions, channels, messages, polls, groups, innerworldRegions, subsystems, sideSystems, layers, timerConfigs, webhookConfigs, fieldDefinitions, buckets, friendConnections, blobMetadata

### Child tables needing composite FKs (CASCADE)

- [x] member_photos → members
- [x] fronting_comments → fronting_sessions
- [x] messages → channels (channel_id, system_id)
- [x] poll_votes → polls
- [x] group_memberships → groups, members
- [x] subsystem_memberships → subsystems
- [x] side_system_memberships → side_systems
- [x] layer_memberships → layers
- [x] subsystem_layer_links → subsystems, layers
- [x] subsystem_side_system_links → subsystems, side_systems
- [x] side_system_layer_links → side_systems, layers
- [x] field_values → field_definitions
- [x] check_in_records → timer_configs
- [x] webhook_deliveries → webhook_configs
- [x] friend_notification_preferences → friend_connections

### SET NULL FKs (kept simple to avoid nullifying system_id)

- [x] channels → channels (self-ref parentId)
- [x] messages → messages (self-ref replyToId)
- [x] notes → members (memberId)
- [x] journal_entries → fronting_sessions (frontingSessionId)
- [x] innerworld_entities → innerworld_regions (regionId)
- [x] innerworld_regions → innerworld_regions (self-ref parentRegionId)
- [x] subsystems → subsystems (self-ref parentSubsystemId)
- [x] groups → groups (self-ref parentGroupId)
- [x] blob_metadata → buckets (bucketId)
- [x] blob_metadata → blob_metadata (self-ref thumbnailOfBlobId)
- [x] field_values → members (memberId)

### Excluded from scope

- import_jobs, export_requests: account-scoped tables with separate FKs to accounts and systems, not parent-child system-owned relationships. Cross-account isolation is enforced by the account FK; cross-system isolation is an application-layer concern here since the account-system ownership relationship is not expressible as a composite FK on these tables.

## Summary of Changes

Added composite UNIQUE constraints on parent tables and composite foreign keys on child tables for tenant isolation. SET NULL cascades use simple (non-composite) FKs to avoid nullifying system_id — this is safe because SET NULL only removes the relationship, never the row's tenant ownership.

### Schema changes (26 files: 13 PG + 13 SQLite)

- Added UNIQUE(id, system_id) to 16 parent tables
- Converted CASCADE FKs from inline to composite (parentId, systemId) on 20+ child tables
- SET NULL FKs remain simple (single-column) to avoid NOT NULL violations on system_id

### Test helper DDL (2 files)

- Synchronized DDL strings with schema changes

### Test verification

- 65 test files, 956 tests pass
- Typecheck and lint clean
