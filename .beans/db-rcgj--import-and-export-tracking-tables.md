---
# db-rcgj
title: Import and export tracking tables
status: todo
type: task
created_at: 2026-03-08T14:22:27Z
updated_at: 2026-03-08T14:22:27Z
parent: db-2je4
blocked_by:
  - db-9f6f
  - db-s6p9
---

Tables for tracking data import/export jobs and GDPR account purge requests.

## Scope

- `import_jobs`: id, account_id (FK), source ('simply-plural'|'pluralkit'|'json'), status ('pending'|'processing'|'completed'|'failed'), progress_percent (integer), error_log (text nullable), chunks_total (integer), chunks_completed (integer), created_at, completed_at (nullable)
- `export_requests`: id, account_id (FK), format ('json'|'csv'), status ('pending'|'processing'|'completed'|'failed'), blob_id (FK nullable — completed export), created_at, completed_at (nullable)
- `account_purge_requests`: id, account_id (FK), status ('requested'|'confirmed'|'processing'|'completed'), requested_at, confirmed_at (nullable), completed_at (nullable)
- All T3 (metadata for job tracking, no user content)
- Indexes: import_jobs (account_id, status), export_requests (account_id), account_purge_requests (account_id)

## Acceptance Criteria

- [ ] import_jobs table with progress tracking
- [ ] export_requests table with blob reference for download
- [ ] account_purge_requests table with multi-step confirmation
- [ ] Indexes for job queue polling
- [ ] Migrations for both dialects
- [ ] Integration test: full import job lifecycle

## References

- features.md section 10 (Data Portability)
- ADR 010 (Background Jobs)
