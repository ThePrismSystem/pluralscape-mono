---
# db-5gj0
title: "Schema audit 004: remaining major findings (M1, M2, M5, M8, M10, M11, P3, S4/S5)"
status: completed
type: task
priority: normal
created_at: 2026-03-12T19:50:32Z
updated_at: 2026-04-16T07:29:37Z
parent: db-hcgk
---

Implement the remaining major findings from audit 004: M1 (NOT NULL + DEFAULT on 10 columns), M2 (fronting session subject CHECK), M5 (deployment-mode guard follow-up), M8 (expand purge partial unique), M10 (size_bytes max CHECK), M11 (SQLite sync_queue seq per-system unique), P3 (remove SQLite messages reply_to_id self-FK), S4/S5 (audit-log-cleanup job type)

## Summary of Changes

**M1 — NOT NULL + DEFAULT on 10 columns:** Added `.notNull()` (with `.default(...)` where appropriate) to: relationships.type, relationships.bidirectional, subsystems.hasCore, field_definitions.required, field_definitions.sortOrder, polls.kind, poll_votes.isVeto, fronting_sessions.frontingType, lifecycle_events.eventType, safe_mode_content.sortOrder. Both PG and SQLite schemas updated.

**M2 — Fronting session subject CHECK:** Added `fronting_sessions_subject_check` ensuring at least one of member_id or custom_front_id is non-null.

**M5 — Deployment-mode guard:** Created follow-up bean `api-e127` (API-layer concern, not DB schema).

**M8 — Expand purge partial unique:** Renamed index to `account_purge_requests_active_unique_idx`, expanded WHERE to `status IN ('pending', 'confirmed', 'processing')`.

**M10 — size_bytes max CHECK:** Added `blob_metadata_size_bytes_max_check` capping at 10 GB (10737418240 bytes).

**M11 — SQLite sync_queue seq per-system unique:** Changed `sync_queue_seq_idx` (global) to `sync_queue_system_id_seq_idx` (system_id, seq).

**P3 — Remove SQLite messages reply_to_id self-FK:** Removed self-referential FK, added soft-reference comment.

**S4/S5 — audit-log-cleanup job type:** Added to JobType union and exhaustive switch test.

**Follow-up beans created:** api-e127 (M5), db-srnd (sync-queue-cleanup), db-e01u (audit-log-cleanup), db-ec71 (SQLite message archival S2).

**Verification:** typecheck 8/8, lint 7/7, unit 1198/1198, SQLite integration 577/577, PG integration 554/554.
