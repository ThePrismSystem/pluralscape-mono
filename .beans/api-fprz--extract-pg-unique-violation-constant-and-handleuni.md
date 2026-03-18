---
# api-fprz
title: Extract PG_UNIQUE_VIOLATION constant and handleUniqueViolation helper
status: completed
type: task
priority: normal
created_at: 2026-03-18T07:12:33Z
updated_at: 2026-03-18T07:36:53Z
parent: api-i2pw
---

PostgreSQL unique-violation code '23505' used as magic string in 8 locations across structure-membership, structure-link, group-membership, and auth services. Extract constant and shared catch helper. Ref: audit P-10, P-11.

## Summary of Changes\n\n- Created `apps/api/src/db.constants.ts` with `PG_UNIQUE_VIOLATION = "23505"`\n- Replaced magic string in 4 service files (8 locations) and 4 test files (7 locations)\n- All usages now reference the shared constant
