---
# api-o4ey
title: Fix all HIGH-severity API audit findings
status: completed
type: task
priority: normal
created_at: 2026-03-18T10:29:18Z
updated_at: 2026-03-18T11:24:35Z
---

Address 10 HIGH-severity findings from docs/local-audits/012-api-core-comprehensive-audit.md before M3. Covers: JSDoc gaps, 204 returns, delete tests, pagination extraction, archive/restore helpers, test mock consolidation, ownership query elimination.

## Summary of Changes

- **H-10**: Added JSDoc to innerworld entity/region constants
- **H-2**: Changed 3 delete endpoints to return 204 No Content
- **H-9**: Added member delete route test with 4 test cases
- **H-4**: Extracted buildPaginatedResult() into lib/pagination.ts, refactored 12 services
- **H-3**: Extracted archiveEntity()/restoreEntity() into lib/entity-lifecycle.ts, refactored 7 services
- **H-5/H-6/H-7/H-8**: Created shared mock factories (common-route-mocks.ts) and request helpers (postJSON/putJSON/patchJSON). Mass migration of 49 inline MOCK_AUTH files deferred to api-4fk5
- **H-1**: Moved system ownership check from DB query to in-memory Set lookup on AuthContext, populated at auth time. Eliminates 1-3+ DB round trips per request
