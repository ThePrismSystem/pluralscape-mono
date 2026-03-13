---
# db-f8y0
title: Fix PR review findings for schema-hardening
status: completed
type: task
priority: normal
created_at: 2026-03-13T15:27:48Z
updated_at: 2026-03-13T19:42:58Z
---

Address all critical, important issues and suggestions from PR #85 review: composite FK for customFrontId, cross-tenant tests, view join regression test, deployment guard wiring, DEPLOYMENT_MODE env handling, type narrowing, test cleanup

## Checklist

- [x] 1. Re-apply RLS after DROP/recreate in migration 0013
- [x] 2. Add error accumulation to pgDetachOldPartitions
- [x] 3. Fix varchar(255) -> varchar(50) in migration 0015
- [x] 4. Use parameterized queries in search_index RLS test
- [x] 5. Add validation for olderThanMonths and monthsAhead
- [x] 6. Fix ADR 020 inaccuracies
- [x] 7. Tighten parameter types (generateRlsStatements, formatPartitionName)
- [x] 8. Remove historical comment in policies.ts
- [x] 9. Extract duplicate CTE result extraction helper
- [x] 10. Fix dead CHECK constraint in SQLite migration 0011

## Note\n\nAudit 008 plan (12 commits) fully completed on fix/db-audit-008. This bean tracks a separate PR #85 review task.

## Summary of Changes

Addressed all 10 findings from PR review: re-applied RLS on partitioned tables, added error accumulation to detach loop, fixed varchar widths, parameterized test queries, added input validators, corrected ADR 020, tightened parameter types, cleaned up comments, extracted CTE helper, and fixed dead CHECK constraint.
