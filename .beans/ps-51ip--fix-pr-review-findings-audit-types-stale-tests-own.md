---
# ps-51ip
title: "Fix PR review findings: audit types, stale tests, ownership coverage"
status: completed
type: task
priority: normal
created_at: 2026-03-18T08:30:57Z
updated_at: 2026-04-16T07:29:44Z
parent: api-tspr
---

Fix all critical/important issues and implement all suggestions from PR review of ownership overhaul:\n1. Restore PgDatabase<PgQueryResultHKT> in audit-log.ts/audit-writer.ts\n2. Fix 4 stale 403 tests (field-value, field-definition, member-photo, member)\n3. Add unit test for system-ownership.ts\n4. Add ownership failure assertions to 8 test files\n5. Extract mockOwnershipFailure helper\n6. Fix setup.service.ts validation ordering\n7. Use branded types in WriteAuditLogParams

## Summary of Changes\n\n1. Restored PgDatabase<PgQueryResultHKT> in audit-log.ts/audit-writer.ts (reverted regression)\n2. Fixed 4 stale 403 tests → 404 (field-value, field-definition, member-photo, member)\n3. Added unit test for system-ownership.ts (4 test cases)\n4. Added ownership failure tests to 8 services (blob, entity, region, nomenclature, pin, settings, setup)\n5. Created mockOwnershipFailure helper, refactored 22 occurrences across 15 test files\n6. Reordered setup.service.ts to check ownership before input validation\n7. Used branded AccountId/SystemId types in WriteAuditLogParams
