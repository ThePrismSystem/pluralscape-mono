---
# client-vhga
title: Report generation
status: completed
type: epic
priority: normal
created_at: 2026-03-08T12:15:47Z
updated_at: 2026-03-28T19:27:05Z
parent: ps-6itw
blocked_by:
  - api-e3hk
---

Client-side report generation. M6 provides the bucket export API endpoint; M8 implements HTML/PDF rendering. Two report types: member report by privacy bucket, meet our system shareable report.

### Scope (4 features)

- [x] 6.1 Report types
- [x] 6.2 Report validation schemas
- [x] 6.3 Bucket export endpoint
- [x] 6.4 Bucket export E2E tests + OpenAPI

## Summary of Changes

All 4 features implemented: report types, validation schemas, bucket export endpoint with JOIN-based queries, and comprehensive E2E tests + OpenAPI documentation.
