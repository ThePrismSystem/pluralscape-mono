---
# api-9bjv
title: Low-priority audit gaps from feature completeness audit
status: completed
type: task
priority: normal
created_at: 2026-03-29T21:31:54Z
updated_at: 2026-03-30T01:13:59Z
parent: api-e7gt
---

Aggregated low-severity gaps from the feature completeness audit. None are launch blockers.

- [ ] D1: Device transfer session cleanup job (background job for expired sessions)
- [ ] D2: Scheduled PII cleanup job for audit log
- [x] D4: Single-photo GET endpoint (/:photoId read)
- [ ] D8: Verify analytics preset names (7/30/90/year) in AnalyticsQuerySchema
- [ ] D8: Add fronting report snapshot update endpoint
- [ ] D9: Server-side @mention notification dispatch
- [ ] D9: Rapid proxy switching as first-class operation
- [ ] D10: Friend code explicit delete vs archive distinction
- [ ] D11: Bucket tags list returns tag records, not full entity objects
- [ ] D12: Verify innerworld entity structureEntityId in update schema
- [ ] D13: Blob DELETE calls archive — confirm if hard delete is needed vs orphan cleanup
- [ ] D14: SSE stream idle timeout
- [ ] D14: Relay envelope signature verification
- [ ] D15: 2FA notification email (no 2FA system exists yet)

Audit ref: docs/audits/feature-completeness-audit-2026-03-29.md — all low-severity gaps

## Summary of Changes

### Implemented

- **D4**: Added GET /:photoId endpoint for single member photo retrieval with 8 tests

### Verified (no changes needed)

- **D8 (analytics)**: Preset names correct (7/30/90/year/all-time/custom)
- **D8 (fronting report update)**: Not applicable — reports are immutable snapshots
- **D10**: Friend code archive is functionally adequate (codes unredeemable)
- **D11**: Bucket tags list already returns lightweight tag records
- **D12**: innerworld entities have no structureEntityId column
- **D13**: Blob DELETE soft-archives, consistent with data lifecycle architecture

### Deferred (complex/infrastructure)

- D1: Device transfer session cleanup job
- D2: Scheduled PII cleanup job for audit log
- D9: Server-side @mention notification dispatch
- D9: Rapid proxy switching
- D14: SSE stream idle timeout
- D14: Relay envelope signature verification
- D15: 2FA notification email (no 2FA system exists)
