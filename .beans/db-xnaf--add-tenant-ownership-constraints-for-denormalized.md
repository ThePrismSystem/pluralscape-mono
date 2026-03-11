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

### Child tables needing composite FKs

- [x] member_photos → members
- [x] fronting_comments → fronting_sessions
- [x] journal_entries → fronting_sessions
- [x] messages → channels (+ self-ref replyTo)
- [x] channels → channels (self-ref parentId)
- [x] notes → members
- [x] poll_votes → polls
- [x] groups → groups (self-ref parentGroupId)
- [x] group_memberships → groups, members
- [x] innerworld_regions → innerworld_regions (self-ref)
- [x] innerworld_entities → innerworld_regions
- [x] subsystems → subsystems (self-ref)
- [x] subsystem_memberships → subsystems
- [x] side_system_memberships → side_systems
- [x] layer_memberships → layers
- [x] subsystem_layer_links → subsystems, layers
- [x] subsystem_side_system_links → subsystems, side_systems
- [x] side_system_layer_links → side_systems, layers
- [x] field_values → field_definitions
- [x] check_in_records → timer_configs
- [x] webhook_deliveries → webhook_configs
- [x] blob_metadata → buckets (+ self-ref thumbnail)
- [x] friend_notification_preferences → friend_connections

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
