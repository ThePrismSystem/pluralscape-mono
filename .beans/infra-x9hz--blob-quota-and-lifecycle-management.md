---
# infra-x9hz
title: Blob quota and lifecycle management
status: todo
type: task
priority: normal
created_at: 2026-03-08T19:58:33Z
updated_at: 2026-03-08T19:58:33Z
parent: infra-o80c
blocked_by:
  - infra-psh9
---

Per-account storage quotas, retention policies, and blob lifecycle management.

## Scope

- Per-account storage quota: configurable limit (default for hosted, admin-set for self-hosted)
- Quota tracking: aggregate blob sizes per account from metadata records
- Quota enforcement: reject uploads exceeding remaining quota
- Quota reporting: current usage, remaining capacity via API
- Retention policies: configurable per deployment (e.g., delete unused blobs after N days)
- Blob reference counting: track which entities reference each blob
- Orphan detection: blobs with zero references after grace period
- Orphan cleanup: background job to delete unreferenced blobs (uses job queue from infra-m2t5)
- Import blob handling: SP avatar ZIP extraction creates many blobs — quota-aware chunked processing

## Acceptance Criteria

- [ ] Per-account storage quota enforcement
- [ ] Configurable quota limits
- [ ] Quota usage reporting endpoint
- [ ] Retention policy configuration
- [ ] Blob reference counting
- [ ] Orphan detection and cleanup
- [ ] Integration with job queue for cleanup jobs
- [ ] Import-aware quota handling
- [ ] Unit tests for quota calculation
- [ ] Integration test: quota enforcement on upload

## References

- ADR 009 (Blob Storage — quotas and retention)
- infra-m2t5 (Background job infrastructure)
