---
# api-9n92
title: "Fix all PR #147 review findings"
status: completed
type: task
priority: high
created_at: 2026-03-17T02:23:27Z
updated_at: 2026-04-16T07:29:42Z
parent: ps-rdqo
---

Address all 16 review findings from PR #147 (system profile CRUD): shared HTTP constants, ZodError handling, extractRequestMeta helper, soft-delete, version increment, transactions, branded types, test updates

## Summary of Changes

- Created shared `apps/api/src/http.constants.ts` with all 9 HTTP status codes, removed duplicates from 3 domain constant files, updated 11 consumer imports
- Added ZodError handling to global error handler (catches by name, returns 400 VALIDATION_ERROR)
- Added `extractRequestMeta` helper to auth service, updated 3 system routes to use it
- Added `archivable()` columns to both PG and SQLite systems tables (schema parity)
- Rewrote system service: branded SystemId/UnixMillis types, `safeParse()` instead of `.parse()`, version increment via SQL expression, transactional update + archive, soft-delete (`archiveSystem`) replacing hard delete, archived system filtering in GET
- Cleaned up route handlers: removed dead code in GET, fixed unsafe type assertion in PUT, added SystemId branded casts
- Updated all 4 route test files: added 500 error tests, argument forwarding assertions, extractRequestMeta mocks, archiveSystem references
- Updated service tests: branded type fixtures, transaction assertions, archive tests, archived filter test
- Added negative version validation test
