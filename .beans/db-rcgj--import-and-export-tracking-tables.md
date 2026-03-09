---
# db-rcgj
title: Import and export tracking tables
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:22:27Z
updated_at: 2026-03-09T23:02:43Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-s6p9
---

Tables for tracking data import/export jobs and GDPR account purge requests.

## Scope

- `import_jobs`: id (UUID PK), account_id (FK → accounts, NOT NULL), system_id (FK → systems, NOT NULL), source ('simply-plural'|'pluralkit'|'json', T3, NOT NULL), status ('pending'|'processing'|'completed'|'failed', T3, NOT NULL, default 'pending'), progress_percent (integer, T3, NOT NULL, default 0), error_log (text, T3, nullable), warning_count (integer, T3, NOT NULL, default 0), chunks_total (integer, T3), chunks_completed (integer, T3, NOT NULL, default 0), created_at (T3, NOT NULL, default NOW()), updated_at (T3), completed_at (T3, nullable)
  - CHECK: `progress_percent BETWEEN 0 AND 100`
- `export_requests`: id (UUID PK), account_id (FK → accounts, NOT NULL), format ('json'|'csv', T3, NOT NULL), status ('pending'|'processing'|'completed'|'failed', T3, NOT NULL, default 'pending'), blob_id (FK → blob_metadata, nullable), created_at (T3, NOT NULL, default NOW()), completed_at (T3, nullable)
- `account_purge_requests`: id (UUID PK), account_id (FK → accounts, NOT NULL), status ('requested'|'confirmed'|'processing'|'completed'|'cancelled', T3, NOT NULL), confirmation_phrase (varchar, T3, NOT NULL — user-typed confirmation text), scheduled_purge_at (T3, NOT NULL — grace period before execution), requested_at (T3, NOT NULL, default NOW()), confirmed_at (T3, nullable), completed_at (T3, nullable), cancelled_at (T3, nullable)

### Cascade rules

- Account deletion → CASCADE: import_jobs, export_requests, account_purge_requests
- All T3 (metadata for job tracking, no user content)
- Indexes: import_jobs (account_id, status), export_requests (account_id), account_purge_requests (account_id)

## Acceptance Criteria

- [ ] import_jobs table with progress tracking
- [ ] export_requests table with blob reference for download
- [ ] system_id on import_jobs for tenant isolation
- [ ] account_purge_requests with confirmation_phrase, scheduled_purge_at, cancelled status
- [ ] account_purge_requests table with multi-step confirmation
- [ ] Indexes for job queue polling
- [ ] Migrations for both dialects
- [ ] Integration test: full import job lifecycle

## References

- features.md section 10 (Data Portability)
- ADR 010 (Background Jobs)
