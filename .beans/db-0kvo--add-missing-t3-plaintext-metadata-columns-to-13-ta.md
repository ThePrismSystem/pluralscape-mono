---
# db-0kvo
title: Add missing T3 plaintext metadata columns to 13+ tables
status: completed
type: bug
priority: critical
created_at: 2026-03-11T04:47:30Z
updated_at: 2026-03-11T06:21:29Z
parent: db-2je4
---

Canonical types mark fields as T3 (server-queryable plaintext) but DB only stores encryptedData. Affected: fronting_sessions (memberId, frontingType, customFrontId, linkedStructure), fronting_comments (memberId), board_messages (senderId), polls (createdByMemberId, kind), poll_votes (optionId, voter, isVeto, votedAt), acknowledgements (createdByMemberId), relationships (sourceMemberId, targetMemberId, type, bidirectional), subsystems (architectureType, hasCore, discoveryStatus), layers (accessType, gatekeeperMemberIds), field_definitions (fieldType, required, sortOrder), field_values (memberId), timer_configs (intervalMinutes, wakingHoursOnly, wakingStart, wakingEnd), check_in_records (respondedByMemberId), lifecycle_events (eventType). Ref: audit CR3

## Implementation Tasks\n\n- [ ] Add new enums (DISCOVERY_STATUSES, FIELD_TYPES, LIFECYCLE_EVENT_TYPES)\n- [ ] Update PG schema files (6 files, 14 tables)\n- [ ] Update SQLite schema files (6 files, 14 tables)\n- [ ] Update PG test helper DDL\n- [ ] Update SQLite test helper DDL\n- [ ] Update integration tests\n- [x] Verify typecheck, lint, tests pass

## Summary of Changes

Added T3 plaintext metadata columns to 14 tables across 12 schema files (6 PG + 6 SQLite):

- fronting_sessions, fronting_comments, board_messages, polls, poll_votes, acknowledgements
- relationships, subsystems, layers, field_definitions, field_values
- timer_configs, check_in_records, lifecycle_events

Also added 3 new enum arrays (DISCOVERY_STATUSES, FIELD_TYPES, LIFECYCLE_EVENT_TYPES), updated test DDL helpers, and added ~50 integration tests covering round-trip, nullable defaults, and CHECK constraint rejection for all new columns.
