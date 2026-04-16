---
# db-43et
title: "Database schema audit 004 fixes: C1-C4, M3, M4, M6, M7, M12, E2, S1"
status: completed
type: task
priority: normal
created_at: 2026-03-12T18:50:52Z
updated_at: 2026-04-16T07:29:37Z
parent: db-hcgk
---

Implement all fixes from audit 004 (comprehensive database schema audit). Covers: C1+C2 (UNIQUE(id) on partitioned tables), C3 (friend code min length CHECK), C4 (device token uniqueness), M3 (composite member FKs), M4+S1 (performance indexes), M6 (fronting_reports RLS), M7 (remove api_keys.name plaintext), M12 (composite self-referential FKs), E2 (audit_log.detail tier clarification).

## Summary of Changes

All 11 findings from audit 004 implemented in a single commit:

- **C1+C2**: Added UNIQUE(id) to PG partitioned tables (messages, audit_log)
- **C3**: Added friend code minimum length CHECK (>= 8 chars)
- **C4**: Added device token (token, platform) uniqueness constraint
- **M3**: Upgraded 4 single-column member FKs to composite (system_id) for tenant isolation
- **M4+S1**: Added 4 performance indexes (fronting sessions, key grants, friend connections, wiki pages)
- **M6**: Added fronting_reports to RLS policies
- **M7**: Removed api_keys.name plaintext column, made encryptedData NOT NULL
- **M12**: Upgraded 4 self-referential FKs to composite (channels, groups, subsystems, regions)
- **E2**: Clarified audit_log.detail as T3 (server-readable); follow-up bean db-kcmt created

36 files changed, 127 insertions, 247 deletions.

## PR Review Fixes

Additional changes from PR review:

- **Critical**: Changed UNIQUE(id) to UNIQUE(id, timestamp) on partitioned tables (audit_log, messages) for PG partition compatibility
- **Important**: Upgraded 5 more single-column member FKs to composite (fronting_sessions.memberId, fronting_comments.memberId, field_values.memberId, relationships.sourceMemberId, relationships.targetMemberId)
- **Suggestion**: Removed redundant friend_connections_friend_system_id_idx (subsumed by friend_connections_friend_status_idx)
- **Suggestion**: Consolidated AuditLogEntry tier map comment (T3 | T3 → single T3)
- **Suggestion**: Committed to T3 for audit_log.detail (removed "tier under review" qualifier)
- **Suggestion**: Documented ServerAuditLogEntry as only Server\* type without encryptedData
- **Tests**: Added 10 new integration tests: friend code min length CHECK (PG+SQLite), device token uniqueness (PG+SQLite), api_keys encryptedData NOT NULL (PG+SQLite)
- **DDL helpers**: Updated pg-helpers.ts and sqlite-helpers.ts to match schema changes
